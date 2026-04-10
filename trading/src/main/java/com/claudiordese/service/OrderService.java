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
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class OrderService {

    private static final Logger logger = LoggerFactory.getLogger(OrderService.class);
    private static final String ORDER_TOPIC = "trading-orders";

    private final MarketResolver marketResolver;
    private final PolymarketAuth polymarketAuth;
    private final PolymarketApiClient apiClient;
    private final OrderSigner orderSigner;
    private final KafkaTemplate<String, OrderEvent> kafkaTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final List<OrderEvent> orders = new CopyOnWriteArrayList<>();

    private PositionManager positionManager;
    private StopLossWebSocketHandler stopLossHandler;

    public OrderService(MarketResolver marketResolver,
                        PolymarketAuth polymarketAuth,
                        PolymarketApiClient apiClient,
                        @Value("${polymarket.private-key}") String privateKey,
                        @Value("${polymarket.proxy-address:}") String proxyAddress,
                        @Nullable @Qualifier("orderKafkaTemplate") KafkaTemplate<String, OrderEvent> kafkaTemplate) {
        this.marketResolver = marketResolver;
        this.polymarketAuth = polymarketAuth;
        this.apiClient = apiClient;
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

    public OrderSigner getOrderSigner() {
        return orderSigner;
    }

    public List<OrderEvent> getAllOrders() {
        return List.copyOf(orders);
    }

    public void placeOrder(long blockId, boolean up) {
        String label = String.format("BUY | block=%d | side=%s", blockId, up ? "Up" : "Down");
        RetryExecutor.execute(label, () -> placeOrderOnce(blockId, up));
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

            boolean negRisk = apiClient.getNegRisk(tokenId);
            int feeRateBps = apiClient.getFeeRate(tokenId);

            JsonNode book = apiClient.getOrderBook(tokenId);
            JsonNode asks = book.get("asks");
            if (asks == null || asks.isEmpty()) {
                saveOrder(new OrderEvent(blockId, side, tokenId, amount, 0, false, null, "FAILED", null, null, null, "No asks in orderbook"));
                return false;
            }
            bestAsk = asks.get(asks.size() - 1).get("price").asDouble();

            logger.info("Placing order: block={}, side={}, price={}, feeRateBps={}, negRisk={}", blockId, side, bestAsk, feeRateBps, negRisk);

            String body = buildOrderPayload(tokenId, amount, bestAsk, feeRateBps, negRisk, true);

            HttpHeaders headers = PolymarketApiClient.toHttpHeaders(polymarketAuth.buildL2Headers("POST", "/order", body));
            ResponseEntity<String> response = apiClient.postOrder(body, headers);

            logger.info("BUY RESPONSE | block={} | body={}", blockId, response.getBody());
            PolymarketApiClient.OrderResponse parsed = apiClient.parseOrderResponse(response.getBody());

            OrderEvent event = new OrderEvent(blockId, side, tokenId, amount, bestAsk, parsed.success(),
                    parsed.orderId(), parsed.status(), parsed.makingAmount(), parsed.takingAmount(), parsed.transactionHash(), null);
            saveOrder(event);
            logger.warn("ORDER {} | block={} | side={} | status={} | orderId={}", parsed.success() ? "SUCCESS" : "FAILED", blockId, side, parsed.status(), parsed.orderId());

            if (parsed.success() && positionManager != null && parsed.takingAmount() != null) {
                double shares = Double.parseDouble(parsed.takingAmount());
                logger.info("POSITION TRACKING | takingAmt={} | makingAmt={} | shares={} | status={}", parsed.takingAmount(), parsed.makingAmount(), shares, parsed.status());
                if (shares <= 0) {
                    logger.warn("ORDER matched but 0 shares received (FAK killed?), not tracking position");
                    return false;
                }
                positionManager.openPosition(blockId, tokenId, side, bestAsk, shares);
                if (stopLossHandler != null) {
                    stopLossHandler.subscribe(tokenId);
                }
            }
            return parsed.success();

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

    public boolean placeSellOrder(long blockId, String tokenId, double shares, double bestBid) {
        if (!isReady()) {
            logger.warn("OrderService not ready, skipping sell for token {}", tokenId);
            saveOrder(new OrderEvent(blockId, "SELL", tokenId, shares, bestBid, false, null, "SKIPPED", null, null, null, "OrderService not ready"));
            return false;
        }

        try {
            double actualShares = fetchTokenBalance(tokenId);
            if (actualShares > 0 && actualShares < shares) {
                logger.warn("Adjusting shares from {} to actual balance {}", shares, actualShares);
                shares = actualShares;
            }

            shares = Math.floor(shares * 100) / 100.0;

            if (shares <= 0) {
                logger.warn("No shares to sell for token {}", tokenId);
                saveOrder(new OrderEvent(blockId, "SELL", tokenId, 0, bestBid, false, null, "SKIPPED", null, null, null, "No shares to sell"));
                return false;
            }

            boolean negRisk = apiClient.getNegRisk(tokenId);
            int feeRateBps = apiClient.getFeeRate(tokenId);

            logger.info("Placing SELL order: block={}, token={}, shares={}, price={}, feeRateBps={}, negRisk={}",
                    blockId, tokenId, shares, bestBid, feeRateBps, negRisk);

            String body = buildOrderPayload(tokenId, shares, bestBid, feeRateBps, negRisk, false);

            HttpHeaders headers = PolymarketApiClient.toHttpHeaders(polymarketAuth.buildL2Headers("POST", "/order", body));
            ResponseEntity<String> response = apiClient.postOrder(body, headers);

            PolymarketApiClient.OrderResponse parsed = apiClient.parseOrderResponse(response.getBody());

            OrderEvent event = new OrderEvent(blockId, "SELL", tokenId, shares, bestBid, parsed.success(),
                    parsed.orderId(), parsed.status(), parsed.makingAmount(), parsed.takingAmount(), parsed.transactionHash(), null);
            saveOrder(event);
            logger.warn("SELL ORDER {} | block={} | token={} | status={} | orderId={}", parsed.success() ? "SUCCESS" : "FAILED", blockId, tokenId, parsed.status(), parsed.orderId());
            return parsed.success();

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

    private String buildOrderPayload(String tokenId, double amount, double price, int feeRateBps, boolean negRisk, boolean isBuy) throws Exception {
        Map<String, Object> signedOrder = isBuy
                ? orderSigner.buildSignedMarketBuyOrder(tokenId, amount, price, feeRateBps, negRisk)
                : orderSigner.buildSignedMarketSellOrder(tokenId, amount, price, feeRateBps, negRisk);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("order", signedOrder);
        payload.put("owner", polymarketAuth.getApiKey());
        payload.put("orderType", "FAK");

        return objectMapper.writeValueAsString(payload);
    }

    private double fetchTokenBalance(String tokenId) {
        try {
            int sigType = orderSigner.getSignatureType();
            HttpHeaders headers = PolymarketApiClient.toHttpHeaders(polymarketAuth.buildL2Headers("GET", "/balance-allowance"));

            ResponseEntity<String> response = apiClient.getBalanceAllowance("CONDITIONAL", tokenId, sigType, headers);

            JsonNode resp = new ObjectMapper().readTree(response.getBody());
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
