package com.claudiordese.service;

import com.claudiordese.dto.OrderEvent;
import com.claudiordese.signing.OrderSigner;
import com.claudiordese.signing.PolymarketAuth;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class OrderService {

    private static final Logger logger = LoggerFactory.getLogger(OrderService.class);
    private static final String CLOB_BASE = "https://clob.polymarket.com";
    private static final String ORDER_TOPIC = "trading-orders";

    private final MarketResolver marketResolver;
    private final PolymarketAuth polymarketAuth;
    private final OrderSigner orderSigner;
    private final KafkaTemplate<String, OrderEvent> kafkaTemplate;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final List<OrderEvent> orders = new CopyOnWriteArrayList<>();

    private PositionManager positionManager;
    private StopLossWebSocketHandler stopLossHandler;

    public OrderService(MarketResolver marketResolver,
                        PolymarketAuth polymarketAuth,
                        @Value("${polymarket.private-key}") String privateKey,
                        @Value("${polymarket.proxy-address:}") String proxyAddress,
                        @Nullable @Qualifier("orderKafkaTemplate") KafkaTemplate<String, OrderEvent> kafkaTemplate) {
        this.marketResolver = marketResolver;
        this.polymarketAuth = polymarketAuth;
        this.orderSigner = (privateKey != null && !privateKey.isBlank())
                ? new OrderSigner(privateKey, proxyAddress.isBlank() ? null : proxyAddress)
                : null;
        this.kafkaTemplate = kafkaTemplate;
    }

    /** Injected lazily to avoid circular dependency */
    public void setPositionManager(PositionManager positionManager) {
        this.positionManager = positionManager;
    }

    public void setStopLossHandler(StopLossWebSocketHandler stopLossHandler) {
        this.stopLossHandler = stopLossHandler;
    }

    public boolean isReady() {
        return orderSigner != null && polymarketAuth.hasApiCredentials();
    }

    public List<OrderEvent> getAllOrders() {
        return List.copyOf(orders);
    }

    private static final int MAX_BUY_RETRIES = 5;

    public void placeOrder(long blockId, boolean up) {
        for (int attempt = 1; attempt <= MAX_BUY_RETRIES; attempt++) {
            logger.warn("BUY attempt {}/{} | block={} | side={}", attempt, MAX_BUY_RETRIES, blockId, up ? "Up" : "Down");
            boolean success = placeOrderOnce(blockId, up);
            if (success) return;
            if (attempt < MAX_BUY_RETRIES) {
                try { Thread.sleep(1000); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            }
        }
        logger.error("BUY EXHAUSTED all {} retries | block={} | side={}", MAX_BUY_RETRIES, blockId, up ? "Up" : "Down");
    }

    private boolean placeOrderOnce(long blockId, boolean up) {
        if (!isReady()) {
            logger.warn("OrderService not ready, skipping order for block {}", blockId);
            saveOrder(new OrderEvent(blockId, up ? "Up" : "Down", null, 1.0, 0, false, null, "SKIPPED", null, null, null, "OrderService not ready"));
            return false;
        }

        String side = up ? "Up" : "Down";
        String tokenId = null;
        double bestAsk = 0;

        try {
            double amount = 1.0;
            MarketResolver.MarketTokens tokens = marketResolver.resolve(blockId);
            if (tokens == null) {
                saveOrder(new OrderEvent(blockId, side, null, amount, 0, false, null, "FAILED", null, null, null, "Market not found"));
                return false;
            }

            tokenId = up ? tokens.upTokenId() : tokens.downTokenId();

            // Get neg-risk
            ResponseEntity<String> negRiskResp = restTemplate.getForEntity(
                    CLOB_BASE + "/neg-risk?token_id=" + tokenId, String.class);
            boolean negRisk = objectMapper.readTree(negRiskResp.getBody()).get("neg_risk").asBoolean();

            // Get fee rate
            ResponseEntity<String> feeResp = restTemplate.getForEntity(
                    CLOB_BASE + "/fee-rate?token_id=" + tokenId, String.class);
            int feeRateBps = objectMapper.readTree(feeResp.getBody()).get("base_fee").asInt();

            // Get best ask
            ResponseEntity<String> bookResp = restTemplate.getForEntity(
                    CLOB_BASE + "/book?token_id=" + tokenId, String.class);
            JsonNode book = objectMapper.readTree(bookResp.getBody());
            JsonNode asks = book.get("asks");
            if (asks == null || asks.isEmpty()) {
                saveOrder(new OrderEvent(blockId, side, tokenId, amount, 0, false, null, "FAILED", null, null, null, "No asks in orderbook"));
                return false;
            }
            bestAsk = asks.get(asks.size() - 1).get("price").asDouble();

            logger.info("Placing order: block={}, side={}, price={}, feeRateBps={}, negRisk={}", blockId, side, bestAsk, feeRateBps, negRisk);

            // Build signed order
            Map<String, Object> signedOrder = orderSigner.buildSignedMarketBuyOrder(
                    tokenId, amount, bestAsk, feeRateBps, negRisk);

            // Build payload
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("order", signedOrder);
            payload.put("owner", polymarketAuth.getApiKey());
            payload.put("orderType", "FAK");

            String body = objectMapper.writeValueAsString(payload);

            // POST with L2 headers
            String path = "/order";
            Map<String, String> authHeaders = polymarketAuth.buildL2Headers("POST", path, body);
            HttpHeaders headers = new HttpHeaders();
            authHeaders.forEach(headers::set);
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<String> response = restTemplate.exchange(
                    CLOB_BASE + path,
                    HttpMethod.POST, new HttpEntity<>(body, headers), String.class);

            // Parse response
            logger.info("BUY RESPONSE | block={} | body={}", blockId, response.getBody());
            JsonNode resp = objectMapper.readTree(response.getBody());
            boolean success = resp.has("success") && resp.get("success").asBoolean();
            String orderId = resp.has("orderID") ? resp.get("orderID").asText() : null;
            String status = resp.has("status") ? resp.get("status").asText() : "unknown";
            String makingAmt = resp.has("makingAmount") ? resp.get("makingAmount").asText() : null;
            String takingAmt = resp.has("takingAmount") ? resp.get("takingAmount").asText() : null;
            String txHash = null;
            if (resp.has("transactionsHashes") && !resp.get("transactionsHashes").isEmpty()) {
                txHash = resp.get("transactionsHashes").get(0).asText();
            }

            OrderEvent event = new OrderEvent(blockId, side, tokenId, amount, bestAsk, success, orderId, status, makingAmt, takingAmt, txHash, null);
            saveOrder(event);
            logger.warn("ORDER {} | block={} | side={} | status={} | orderId={}", success ? "SUCCESS" : "FAILED", blockId, side, status, orderId);

            // Track position and start stop-loss monitoring on successful buy
            if (success && positionManager != null && takingAmt != null) {
                double shares = Double.parseDouble(takingAmt);
                logger.info("POSITION TRACKING | takingAmt={} | makingAmt={} | shares={} | status={}", takingAmt, makingAmt, shares, status);
                if (shares <= 0) {
                    logger.warn("ORDER matched but 0 shares received (FAK killed?), not tracking position");
                    return false;
                }
                positionManager.openPosition(blockId, tokenId, side, bestAsk, shares);
                if (stopLossHandler != null) {
                    stopLossHandler.subscribe(tokenId);
                }
            }
            return success;

        } catch (HttpClientErrorException e) {
            String error = e.getResponseBodyAsString();
            logger.error("Order failed for block {}: {}", blockId, error);
            saveOrder(new OrderEvent(blockId, side, tokenId, 2.0, bestAsk, false, null, "FAILED", null, null, null, error));
            return false;
        } catch (Exception e) {
            logger.error("Order error for block {}: {}", blockId, e.getMessage(), e);
            saveOrder(new OrderEvent(blockId, side, tokenId, 2.0, bestAsk, false, null, "ERROR", null, null, null, e.getMessage()));
            return false;
        }
    }

    /**
     * @return true if the sell order was placed successfully
     */
    public boolean placeSellOrder(long blockId, String tokenId, double shares, double bestBid) {
        if (!isReady()) {
            logger.warn("OrderService not ready, skipping sell for token {}", tokenId);
            saveOrder(new OrderEvent(blockId, "SELL", tokenId, shares, bestBid, false, null, "SKIPPED", null, null, null, "OrderService not ready"));
            return false;
        }

        try {
            // Fetch actual on-chain balance instead of relying on buy response
            double actualShares = fetchTokenBalance(tokenId);
            if (actualShares > 0 && actualShares < shares) {
                logger.warn("Adjusting shares from {} to actual balance {}", shares, actualShares);
                shares = actualShares;
            }

            // Round shares to 2 decimals (Polymarket requirement for sell maker amount)
            shares = Math.floor(shares * 100) / 100.0;

            if (shares <= 0) {
                logger.warn("No shares to sell for token {}", tokenId);
                saveOrder(new OrderEvent(blockId, "SELL", tokenId, 0, bestBid, false, null, "SKIPPED", null, null, null, "No shares to sell"));
                return false;
            }

            // Get neg-risk
            ResponseEntity<String> negRiskResp = restTemplate.getForEntity(
                    CLOB_BASE + "/neg-risk?token_id=" + tokenId, String.class);
            boolean negRisk = objectMapper.readTree(negRiskResp.getBody()).get("neg_risk").asBoolean();

            // Get fee rate
            ResponseEntity<String> feeResp = restTemplate.getForEntity(
                    CLOB_BASE + "/fee-rate?token_id=" + tokenId, String.class);
            int feeRateBps = objectMapper.readTree(feeResp.getBody()).get("base_fee").asInt();

            logger.info("Placing SELL order: block={}, token={}, shares={}, price={}, feeRateBps={}, negRisk={}",
                    blockId, tokenId, shares, bestBid, feeRateBps, negRisk);

            // Build signed sell order
            Map<String, Object> signedOrder = orderSigner.buildSignedMarketSellOrder(
                    tokenId, shares, bestBid, feeRateBps, negRisk);

            // Build payload
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("order", signedOrder);
            payload.put("owner", polymarketAuth.getApiKey());
            payload.put("orderType", "FAK");

            String body = objectMapper.writeValueAsString(payload);

            // POST with L2 headers
            String path = "/order";
            Map<String, String> authHeaders = polymarketAuth.buildL2Headers("POST", path, body);
            HttpHeaders headers = new HttpHeaders();
            authHeaders.forEach(headers::set);
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<String> response = restTemplate.exchange(
                    CLOB_BASE + path,
                    HttpMethod.POST, new HttpEntity<>(body, headers), String.class);

            JsonNode resp = objectMapper.readTree(response.getBody());
            boolean success = resp.has("success") && resp.get("success").asBoolean();
            String orderId = resp.has("orderID") ? resp.get("orderID").asText() : null;
            String status = resp.has("status") ? resp.get("status").asText() : "unknown";
            String makingAmt = resp.has("makingAmount") ? resp.get("makingAmount").asText() : null;
            String takingAmt = resp.has("takingAmount") ? resp.get("takingAmount").asText() : null;
            String txHash = null;
            if (resp.has("transactionsHashes") && !resp.get("transactionsHashes").isEmpty()) {
                txHash = resp.get("transactionsHashes").get(0).asText();
            }

            OrderEvent event = new OrderEvent(blockId, "SELL", tokenId, shares, bestBid, success, orderId, status, makingAmt, takingAmt, txHash, null);
            saveOrder(event);
            logger.warn("SELL ORDER {} | block={} | token={} | status={} | orderId={}", success ? "SUCCESS" : "FAILED", blockId, tokenId, status, orderId);
            return success;

        } catch (HttpClientErrorException e) {
            String error = e.getResponseBodyAsString();
            logger.error("Sell order failed for token {}: {}", tokenId, error);
            saveOrder(new OrderEvent(blockId, "SELL", tokenId, shares, bestBid, false, null, "FAILED", null, null, null, error));
            return false;
        } catch (Exception e) {
            logger.error("Sell order error for token {}: {}", tokenId, e.getMessage(), e);
            saveOrder(new OrderEvent(blockId, "SELL", tokenId, shares, bestBid, false, null, "ERROR", null, null, null, e.getMessage()));
            return false;
        }
    }

    private void updateConditionalAllowance(String tokenId) {
        try {
            int sigType = orderSigner.getSignatureType();
            String path = "/update-balance-allowance";

            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("asset_type", "CONDITIONAL");
            requestBody.put("token_id", tokenId);
            requestBody.put("signature_type", sigType);

            String body = objectMapper.writeValueAsString(requestBody);

            Map<String, String> authHeaders = polymarketAuth.buildL2Headers("POST", path, body);
            HttpHeaders headers = new HttpHeaders();
            authHeaders.forEach(headers::set);
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<String> response = restTemplate.exchange(
                    CLOB_BASE + path,
                    HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
            logger.info("Updated allowance for token {}: {}", tokenId, response.getBody());
        } catch (Exception e) {
            logger.warn("Failed to update allowance for token {}: {}", tokenId, e.getMessage());
        }
    }

    private double fetchTokenBalance(String tokenId) {
        try {
            int sigType = orderSigner.getSignatureType();
            String path = "/balance-allowance";
            Map<String, String> authHeaders = polymarketAuth.buildL2Headers("GET", path);
            HttpHeaders headers = new HttpHeaders();
            authHeaders.forEach(headers::set);

            ResponseEntity<String> response = restTemplate.exchange(
                    CLOB_BASE + path + "?asset_type=CONDITIONAL&token_id=" + tokenId + "&signature_type=" + sigType,
                    HttpMethod.GET, new HttpEntity<>(headers), String.class);

            JsonNode resp = objectMapper.readTree(response.getBody());
            long rawBalance = resp.get("balance").asLong();
            double balance = rawBalance / 1_000_000.0;
            logger.info("Token balance for {}: raw={}, shares={}", tokenId, rawBalance, balance);
            return balance;
        } catch (Exception e) {
            logger.warn("Failed to fetch token balance for {}: {}", tokenId, e.getMessage());
            return -1;
        }
    }

    private void saveOrder(OrderEvent event) {
        orders.add(event);
        if (kafkaTemplate != null) {
            kafkaTemplate.send(ORDER_TOPIC, String.valueOf(event.blockId()), event).whenComplete((result, error) -> {
                if (error != null) {
                    logger.error("Failed to send order event to Kafka: {}", error.getMessage());
                } else {
                    logger.info("Order event sent to topic {} offset {}", ORDER_TOPIC, result.getRecordMetadata().offset());
                }
            });
        }
    }
}
