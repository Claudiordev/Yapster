package com.claudiordese.controllers;

import com.claudiordese.dto.HitEvent;
import com.claudiordese.dto.OrderEvent;
import com.claudiordese.service.HitConsumer;
import com.claudiordese.service.MarketResolver;
import com.claudiordese.service.OrderService;
import com.claudiordese.service.PositionManager;
import com.claudiordese.service.TradingHandler;
import com.claudiordese.service.WebSocketConnectionManager;
import com.claudiordese.signing.OrderSigner;
import com.claudiordese.signing.PolymarketAuth;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/trading")
public class TradingController {

    private static final Logger logger = LoggerFactory.getLogger(TradingController.class);
    private static final String CLOB_BASE = "https://clob.polymarket.com";

    private final WebSocketConnectionManager connectionManager;
    private final HitConsumer hitConsumer;
    private final TradingHandler tradingHandler;
    private final PolymarketAuth polymarketAuth;
    private final MarketResolver marketResolver;
    private final OrderSigner orderSigner;
    private final OrderService orderService;
    private final PositionManager positionManager;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public TradingController(WebSocketConnectionManager connectionManager,
                             @org.springframework.lang.Nullable HitConsumer hitConsumer,
                             TradingHandler tradingHandler,
                             PolymarketAuth polymarketAuth,
                             MarketResolver marketResolver,
                             OrderService orderService,
                             PositionManager positionManager,
                             @Value("${polymarket.private-key}") String privateKey,
                             @Value("${polymarket.proxy-address:}") String proxyAddress) {
        this.connectionManager = connectionManager;
        this.hitConsumer = hitConsumer;
        this.tradingHandler = tradingHandler;
        this.polymarketAuth = polymarketAuth;
        this.marketResolver = marketResolver;
        this.orderService = orderService;
        this.positionManager = positionManager;
        this.orderSigner = (privateKey != null && !privateKey.isBlank())
                ? new OrderSigner(privateKey, proxyAddress.isBlank() ? null : proxyAddress)
                : null;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        if (!polymarketAuth.isConfigured()) return;
        try {
            Map<String, String> authHeaders = polymarketAuth.buildL1Headers();
            HttpHeaders headers = new HttpHeaders();
            authHeaders.forEach(headers::set);

            ResponseEntity<String> response = restTemplate.exchange(
                    CLOB_BASE + "/auth/derive-api-key",
                    HttpMethod.GET, new HttpEntity<>(headers), String.class);

            JsonNode json = objectMapper.readTree(response.getBody());
            polymarketAuth.setApiCredentials(
                    json.get("apiKey").asText(),
                    json.get("secret").asText(),
                    json.get("passphrase").asText()
            );
        } catch (Exception e) {
            logger.warn("Could not auto-derive API credentials: {}", e.getMessage());
        }
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
                "connected", connectionManager.isConnected(),
                "l2Auth", polymarketAuth.hasApiCredentials()
        ));
    }

    @GetMapping("/hits")
    public ResponseEntity<List<HitEvent>> getHits() {
        if (hitConsumer == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(hitConsumer.getAllHits());
    }

    @GetMapping("/orders")
    public ResponseEntity<List<OrderEvent>> getOrders() {
        return ResponseEntity.ok(orderService.getAllOrders());
    }

    @PostMapping("/connect")
    public ResponseEntity<Map<String, String>> connect() {
        connectionManager.connect();
        return ResponseEntity.ok(Map.of("message", "Connection initiated"));
    }

    @PostMapping("/disconnect")
    public ResponseEntity<Map<String, String>> disconnect() {
        connectionManager.disconnect();
        return ResponseEntity.ok(Map.of("message", "Disconnected"));
    }

    @PostMapping("/auth/create-api-key")
    public ResponseEntity<String> createApiKey() {
        if (!polymarketAuth.isConfigured()) {
            return ResponseEntity.badRequest().body("Private key not configured");
        }
        try {
            Map<String, String> authHeaders = polymarketAuth.buildL1Headers();
            HttpHeaders headers = new HttpHeaders();
            authHeaders.forEach(headers::set);

            ResponseEntity<String> response = restTemplate.exchange(
                    CLOB_BASE + "/auth/api-key",
                    HttpMethod.POST, new HttpEntity<>(headers), String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        }
    }

    @GetMapping("/auth/derive-api-key")
    public ResponseEntity<String> deriveApiKey() {
        if (!polymarketAuth.isConfigured()) {
            return ResponseEntity.badRequest().body("Private key not configured");
        }
        try {
            Map<String, String> authHeaders = polymarketAuth.buildL1Headers();
            HttpHeaders headers = new HttpHeaders();
            authHeaders.forEach(headers::set);

            ResponseEntity<String> response = restTemplate.exchange(
                    CLOB_BASE + "/auth/derive-api-key",
                    HttpMethod.GET, new HttpEntity<>(headers), String.class);

            JsonNode json = objectMapper.readTree(response.getBody());
            polymarketAuth.setApiCredentials(
                    json.get("apiKey").asText(),
                    json.get("secret").asText(),
                    json.get("passphrase").asText()
            );
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
    }

    @GetMapping("/balance")
    public ResponseEntity<String> getBalance() {
        if (!polymarketAuth.hasApiCredentials()) {
            return ResponseEntity.badRequest().body("L2 credentials not available.");
        }
        try {
            String path = "/balance-allowance";
            int sigType = orderSigner != null ? orderSigner.getSignatureType() : 0;
            Map<String, String> authHeaders = polymarketAuth.buildL2Headers("GET", path);
            HttpHeaders headers = new HttpHeaders();
            authHeaders.forEach(headers::set);

            ResponseEntity<String> response = restTemplate.exchange(
                    CLOB_BASE + path + "?asset_type=COLLATERAL&signature_type=" + sigType,
                    HttpMethod.GET, new HttpEntity<>(headers), String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        }
    }

    /**
     * Check conditional token balance for a specific token.
     * GET /api/v1/trading/balance/token?tokenId=...
     */
    @GetMapping("/balance/token")
    public ResponseEntity<String> getTokenBalance(@RequestParam String tokenId) {
        if (!polymarketAuth.hasApiCredentials()) {
            return ResponseEntity.badRequest().body("L2 credentials not available.");
        }
        try {
            int sigType = orderSigner != null ? orderSigner.getSignatureType() : 0;
            String path = "/balance-allowance";
            Map<String, String> authHeaders = polymarketAuth.buildL2Headers("GET", path);
            HttpHeaders headers = new HttpHeaders();
            authHeaders.forEach(headers::set);

            ResponseEntity<String> response = restTemplate.exchange(
                    CLOB_BASE + path + "?asset_type=CONDITIONAL&token_id=" + tokenId + "&signature_type=" + sigType,
                    HttpMethod.GET, new HttpEntity<>(headers), String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        }
    }

    /**
     * Update balance allowance (approve exchange to transfer tokens).
     * POST /api/v1/trading/approve?tokenId=...
     */
    @PostMapping("/approve")
    public ResponseEntity<String> updateAllowance(@RequestParam(required = false) String tokenId) {
        if (!polymarketAuth.hasApiCredentials()) {
            return ResponseEntity.badRequest().body("L2 credentials not available.");
        }
        try {
            String path = "/update-balance-allowance";
            int sigType = orderSigner != null ? orderSigner.getSignatureType() : 0;

            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("asset_type", tokenId != null ? "CONDITIONAL" : "COLLATERAL");
            if (tokenId != null) requestBody.put("token_id", tokenId);
            requestBody.put("signature_type", sigType);

            String body = objectMapper.writeValueAsString(requestBody);

            Map<String, String> authHeaders = polymarketAuth.buildL2Headers("POST", path, body);
            HttpHeaders headers = new HttpHeaders();
            authHeaders.forEach(headers::set);
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<String> response = restTemplate.exchange(
                    CLOB_BASE + path,
                    HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    /**
     * Place a market BUY order.
     * Example: POST /api/v1/trading/order?tokenId=...&amount=1.0
     * Automatically fetches the best ask price from the orderbook.
     */
    @PostMapping("/order")
    public ResponseEntity<String> placeMarketBuyOrder(
            @RequestParam String tokenId,
            @RequestParam(defaultValue = "1.0") double amount) {
        if (!polymarketAuth.hasApiCredentials() || orderSigner == null) {
            return ResponseEntity.badRequest().body("Auth not configured");
        }
        try {
            // 1. Get neg-risk status
            ResponseEntity<String> negRiskResp = restTemplate.getForEntity(
                    CLOB_BASE + "/neg-risk?token_id=" + tokenId, String.class);
            boolean negRisk = objectMapper.readTree(negRiskResp.getBody()).get("neg_risk").asBoolean();

            // 2. Get fee rate
            ResponseEntity<String> feeResp = restTemplate.getForEntity(
                    CLOB_BASE + "/fee-rate?token_id=" + tokenId, String.class);
            int feeRateBps = objectMapper.readTree(feeResp.getBody()).get("base_fee").asInt();

            // 3. Get best ask price from orderbook
            ResponseEntity<String> bookResp = restTemplate.getForEntity(
                    CLOB_BASE + "/book?token_id=" + tokenId, String.class);
            JsonNode book = objectMapper.readTree(bookResp.getBody());
            JsonNode asks = book.get("asks");
            if (asks == null || asks.isEmpty()) {
                return ResponseEntity.badRequest().body("No asks in orderbook for this token");
            }
            // asks are sorted by price ascending, first is best
            double bestAsk = asks.get(0).get("price").asDouble();

            logger.info("Placing market BUY: tokenId={}, amount={}, price={}, feeRateBps={}, negRisk={}",
                    tokenId, amount, bestAsk, feeRateBps, negRisk);

            // 4. Build and sign the order
            Map<String, Object> signedOrder = orderSigner.buildSignedMarketBuyOrder(
                    tokenId, amount, bestAsk, feeRateBps, negRisk);

            // 5. Build the POST payload
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("order", signedOrder);
            payload.put("owner", polymarketAuth.getApiKey());
            payload.put("orderType", "FAK"); // Fill-or-Kill for market orders

            String body = objectMapper.writeValueAsString(payload);
            logger.info("Order payload: {}", body);

            // 6. Sign with L2 HMAC and POST
            String path = "/order";
            Map<String, String> authHeaders = polymarketAuth.buildL2Headers("POST", path, body);
            HttpHeaders headers = new HttpHeaders();
            authHeaders.forEach(headers::set);
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<String> response = restTemplate.exchange(
                    CLOB_BASE + path,
                    HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            logger.error("Order failed: {}", e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            logger.error("Order error: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    /**
     * Place a market BUY order using the block ID from TradingHandler.
     * Example: POST /api/v1/trading/order/block?blockId=1772737500&side=up&amount=1.0
     */
    @PostMapping("/order/block")
    public ResponseEntity<String> placeBlockOrder(
            @RequestParam long blockId,
            @RequestParam(defaultValue = "up") String side,
            @RequestParam(defaultValue = "1.0") double amount) {

        MarketResolver.MarketTokens tokens = marketResolver.resolve(blockId);
        if (tokens == null) {
            return ResponseEntity.badRequest().body("Market not found for blockId: " + blockId);
        }

        String tokenId = side.equalsIgnoreCase("up") ? tokens.upTokenId() : tokens.downTokenId();
        logger.info("Block {} resolved: side={}, tokenId={}", blockId, side, tokenId);

        return placeMarketBuyOrder(tokenId, amount);
    }

    /**
     * Resolve token IDs for a block.
     * GET /api/v1/trading/resolve?blockId=1773838500
     */
    @GetMapping("/resolve")
    public ResponseEntity<?> resolveTokens(@RequestParam long blockId) {
        MarketResolver.MarketTokens tokens = marketResolver.resolve(blockId);
        if (tokens == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Market not found for blockId: " + blockId));
        }
        return ResponseEntity.ok(Map.of(
                "blockId", tokens.blockId(),
                "upTokenId", tokens.upTokenId(),
                "downTokenId", tokens.downTokenId()
        ));
    }

    /**
     * Place a market SELL order by tokenId.
     * POST /api/v1/trading/sell?tokenId=...&shares=1.49&price=0.55
     * If price is omitted, uses the best bid from the orderbook.
     */
    @PostMapping("/sell")
    public ResponseEntity<String> placeMarketSellOrder(
            @RequestParam String tokenId,
            @RequestParam double shares,
            @RequestParam(required = false) Double price) {
        if (!polymarketAuth.hasApiCredentials() || orderSigner == null) {
            return ResponseEntity.badRequest().body("Auth not configured");
        }
        try {
            double bestBid = price != null ? price : 0;

            if (bestBid <= 0) {
                // Fetch best bid from orderbook
                ResponseEntity<String> bookResp = restTemplate.getForEntity(
                        CLOB_BASE + "/book?token_id=" + tokenId, String.class);
                JsonNode book = objectMapper.readTree(bookResp.getBody());
                JsonNode bids = book.get("bids");
                if (bids == null || bids.isEmpty()) {
                    return ResponseEntity.badRequest().body("No bids in orderbook for this token");
                }
                for (JsonNode bid : bids) {
                    double p = bid.get("price").asDouble();
                    if (p > bestBid) bestBid = p;
                }
            }

            boolean success = orderService.placeSellOrder(0, tokenId, shares, bestBid);
            if (success) {
                return ResponseEntity.ok(Map.of("success", true, "shares", shares, "price", bestBid).toString());
            } else {
                return ResponseEntity.badRequest().body("Sell order failed, check logs");
            }
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            logger.error("Sell error: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(e.getMessage());
        }
    }

    /**
     * Get open and closed positions.
     * GET /api/v1/trading/positions
     */
    @GetMapping("/positions")
    public ResponseEntity<Map<String, Object>> getPositions() {
        return ResponseEntity.ok(Map.of(
                "open", positionManager.getOpenPositions(),
                "closed", positionManager.getClosedPositions()
        ));
    }

    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> getSettings() {
        return ResponseEntity.ok(Map.of(
                "priceThreshold", tradingHandler.getPriceThreshold(),
                "timeThreshold", tradingHandler.getTimeThreshold(),
                "stopLossPercent", tradingHandler.getStopLossPercent(),
                "takeProfitPercent", tradingHandler.getTakeProfitPercent()
        ));
    }

    @PutMapping("/settings")
    public ResponseEntity<Map<String, Object>> updateSettings(@RequestBody Map<String, Object> body) {
        if (body.containsKey("priceThreshold")) {
            tradingHandler.setPriceThreshold(((Number) body.get("priceThreshold")).doubleValue());
        }
        if (body.containsKey("timeThreshold")) {
            tradingHandler.setTimeThreshold(((Number) body.get("timeThreshold")).longValue());
        }
        if (body.containsKey("stopLossPercent")) {
            tradingHandler.setStopLossPercent(((Number) body.get("stopLossPercent")).doubleValue());
        }
        if (body.containsKey("takeProfitPercent")) {
            tradingHandler.setTakeProfitPercent(((Number) body.get("takeProfitPercent")).doubleValue());
        }
        return ResponseEntity.ok(Map.of(
                "priceThreshold", tradingHandler.getPriceThreshold(),
                "timeThreshold", tradingHandler.getTimeThreshold(),
                "stopLossPercent", tradingHandler.getStopLossPercent(),
                "takeProfitPercent", tradingHandler.getTakeProfitPercent()
        ));
    }
}
