package com.claudiordese.controllers;

import com.claudiordese.dto.HitEvent;
import com.claudiordese.dto.OrderEvent;
import com.claudiordese.service.HitConsumer;
import com.claudiordese.service.MarketResolver;
import com.claudiordese.service.OrderService;
import com.claudiordese.service.PolymarketApiClient;
import com.claudiordese.service.PositionManager;
import com.claudiordese.service.TradingHandler;
import com.claudiordese.service.WebSocketConnectionManager;
import com.claudiordese.signing.PolymarketAuth;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpClientErrorException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/trading")
public class TradingController {

    private static final Logger logger = LoggerFactory.getLogger(TradingController.class);

    private final WebSocketConnectionManager connectionManager;
    private final HitConsumer hitConsumer;
    private final TradingHandler tradingHandler;
    private final PolymarketAuth polymarketAuth;
    private final PolymarketApiClient apiClient;
    private final MarketResolver marketResolver;
    private final OrderService orderService;
    private final PositionManager positionManager;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public TradingController(WebSocketConnectionManager connectionManager,
                             @org.springframework.lang.Nullable HitConsumer hitConsumer,
                             TradingHandler tradingHandler,
                             PolymarketAuth polymarketAuth,
                             PolymarketApiClient apiClient,
                             MarketResolver marketResolver,
                             OrderService orderService,
                             PositionManager positionManager) {
        this.connectionManager = connectionManager;
        this.hitConsumer = hitConsumer;
        this.tradingHandler = tradingHandler;
        this.polymarketAuth = polymarketAuth;
        this.apiClient = apiClient;
        this.marketResolver = marketResolver;
        this.orderService = orderService;
        this.positionManager = positionManager;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        if (!polymarketAuth.isConfigured()) return;
        try {
            HttpHeaders headers = PolymarketApiClient.toHttpHeaders(polymarketAuth.buildL1Headers());
            ResponseEntity<String> response = apiClient.deriveApiKey(headers);

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
            HttpHeaders headers = PolymarketApiClient.toHttpHeaders(polymarketAuth.buildL1Headers());
            ResponseEntity<String> response = apiClient.createApiKey(headers);
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
            HttpHeaders headers = PolymarketApiClient.toHttpHeaders(polymarketAuth.buildL1Headers());
            ResponseEntity<String> response = apiClient.deriveApiKey(headers);

            JsonNode json = objectMapper.readTree(response.getBody());
            polymarketAuth.setApiCredentials(
                    json.get("apiKey").asText(),
                    json.get("secret").asText(),
                    json.get("passphrase").asText()
            );
            return ResponseEntity.ok(response.getBody());
        } catch (HttpClientErrorException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @GetMapping("/balance")
    public ResponseEntity<String> getBalance() {
        if (!polymarketAuth.hasApiCredentials()) {
            return ResponseEntity.badRequest().body("L2 credentials not available.");
        }
        try {
            int sigType = getSignatureType();
            HttpHeaders headers = PolymarketApiClient.toHttpHeaders(polymarketAuth.buildL2Headers("GET", "/balance-allowance"));
            ResponseEntity<String> response = apiClient.getBalanceAllowance("COLLATERAL", null, sigType, headers);
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
            int sigType = getSignatureType();
            HttpHeaders headers = PolymarketApiClient.toHttpHeaders(polymarketAuth.buildL2Headers("GET", "/balance-allowance"));
            ResponseEntity<String> response = apiClient.getBalanceAllowance("CONDITIONAL", tokenId, sigType, headers);
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
            int sigType = getSignatureType();

            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("asset_type", tokenId != null ? "CONDITIONAL" : "COLLATERAL");
            if (tokenId != null) requestBody.put("token_id", tokenId);
            requestBody.put("signature_type", sigType);

            String body = objectMapper.writeValueAsString(requestBody);
            HttpHeaders headers = PolymarketApiClient.toHttpHeaders(polymarketAuth.buildL2Headers("POST", "/update-balance-allowance", body));
            ResponseEntity<String> response = apiClient.updateBalanceAllowance(body, headers);
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
        if (!orderService.isReady()) {
            return ResponseEntity.badRequest().body("Auth not configured");
        }
        try {
            boolean negRisk = apiClient.getNegRisk(tokenId);
            int feeRateBps = apiClient.getFeeRate(tokenId);

            JsonNode book = apiClient.getOrderBook(tokenId);
            JsonNode asks = book.get("asks");
            if (asks == null || asks.isEmpty()) {
                return ResponseEntity.badRequest().body("No asks in orderbook for this token");
            }
            double bestAsk = asks.get(0).get("price").asDouble();

            logger.info("Placing market BUY: tokenId={}, amount={}, price={}, feeRateBps={}, negRisk={}",
                    tokenId, amount, bestAsk, feeRateBps, negRisk);

            Map<String, Object> signedOrder = orderService.getOrderSigner().buildSignedMarketBuyOrder(
                    tokenId, amount, bestAsk, feeRateBps, negRisk);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("order", signedOrder);
            payload.put("owner", polymarketAuth.getApiKey());
            payload.put("orderType", "FAK");

            String body = objectMapper.writeValueAsString(payload);
            logger.info("Order payload: {}", body);

            HttpHeaders headers = PolymarketApiClient.toHttpHeaders(polymarketAuth.buildL2Headers("POST", "/order", body));
            ResponseEntity<String> response = apiClient.postOrder(body, headers);
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
        if (!orderService.isReady()) {
            return ResponseEntity.badRequest().body("Auth not configured");
        }
        try {
            double bestBid = price != null ? price : 0;

            if (bestBid <= 0) {
                JsonNode book = apiClient.getOrderBook(tokenId);
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

    private int getSignatureType() {
        return orderService.getOrderSigner() != null ? orderService.getOrderSigner().getSignatureType() : 0;
    }
}
