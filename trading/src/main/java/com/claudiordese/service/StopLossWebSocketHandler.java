package com.claudiordese.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.WebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class StopLossWebSocketHandler extends TextWebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(StopLossWebSocketHandler.class);
    private static final String CLOB_WS_URL = "wss://ws-subscriptions-frontend-clob.polymarket.com/ws/market";

    @Value("${trading.feature.stopLoss.delay}")
    private long DELAY_MS;

    @Value("${trading.socket.reconnect-interval-ms}")
    private long DELAY_REOPEN_MS;

    private final PositionManager positionManager;
    private final OrderService orderService;
    private final TradingHandler tradingHandler;
    private final WebSocketClient webSocketClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public StopLossWebSocketHandler(PositionManager positionManager,
                                     OrderService orderService,
                                     TradingHandler tradingHandler,
                                     WebSocketClient webSocketClient) {
        this.positionManager = positionManager;
        this.orderService = orderService;
        this.tradingHandler = tradingHandler;
        this.webSocketClient = webSocketClient;
    }

    /**
     * Subscribe to the CLOB order book WebSocket for a given token ID.
     */
    public void subscribe(String tokenId) {
        logger.info("Scheduling stop-loss monitoring in {} milliseconds", DELAY_MS);
        scheduler.schedule(() -> doSubscribe(tokenId), DELAY_MS, TimeUnit.MILLISECONDS);
    }

    public void doSubscribe(String tokenId) {
        if(!positionManager.hasOpenPosition(tokenId)) {
            logger.warn("No open positions for token id {}", tokenId);
            return;
        }

        if (sessions.containsKey(tokenId)) {
            logger.info("Already subscribed to order book for token {}", tokenId);
            return;
        }

        try {
            // Create a per-token handler that delegates to this class
            TextWebSocketHandler handler = new TextWebSocketHandler() {
                @Override
                public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                    sessions.put(tokenId, session);
                    String subscribeMsg = objectMapper.writeValueAsString(Map.of(
                            "type", "markets",
                            "assets_ids", new String[]{tokenId}
                    ));
                    session.sendMessage(new TextMessage(subscribeMsg));
                    logger.info("STOP-LOSS subscribed to order book for token {}", tokenId);
                }

                @Override
                protected void handleTextMessage(WebSocketSession session, TextMessage message) {
                    StopLossWebSocketHandler.this.processMessage(tokenId, message.getPayload());
                }

                @Override
                public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
                    sessions.remove(tokenId);
                    logger.warn("STOP-LOSS WebSocket closed for token {}: {}", tokenId, status);
                    // Reconnect if position is still open
                    if (positionManager.hasOpenPosition(tokenId)) {
                        logger.warn("Position still open, reopening in {} milliseconds", DELAY_REOPEN_MS);
                        scheduler.schedule(() -> subscribe(tokenId), DELAY_REOPEN_MS, TimeUnit.MILLISECONDS);
                    }
                }

                @Override
                public void handleTransportError(WebSocketSession session, Throwable exception) {
                    logger.error("STOP-LOSS transport error for token {}: {}", tokenId, exception.getMessage());
                }
            };

            webSocketClient.execute(handler, CLOB_WS_URL).get(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            logger.error("Failed to connect to CLOB WebSocket for token {}: {}", tokenId, e.getMessage());
            // Retry if position still open
            if (positionManager.hasOpenPosition(tokenId)) {
                scheduler.schedule(() -> subscribe(tokenId), DELAY_REOPEN_MS, TimeUnit.MILLISECONDS);
            }
        }
    }

    public void unsubscribe(String tokenId) {
        WebSocketSession session = sessions.remove(tokenId);
        if (session != null && session.isOpen()) {
            try {
                session.close();
            } catch (Exception e) {
                logger.error("Error closing CLOB WebSocket for token {}: {}", tokenId, e.getMessage());
            }
        }
    }

    private void processMessage(String tokenId, String payload) {
        try {

            JsonNode root = objectMapper.readTree(payload);

            // We're looking for book events with bids
            JsonNode bids = root.get("bids");
            if (bids == null || bids.isEmpty()) return;

            // Best bid is the highest price — bids are sorted ascending
            double bestBid = 0;
            for (JsonNode bid : bids) {
                double price = bid.get("price").asDouble();
                if (price > bestBid) bestBid = price;
            }

            if (bestBid <= 0) return;

            PositionManager.Position position = positionManager.getPosition(tokenId);
            if (position == null) {
                unsubscribe(tokenId);
                return;
            }

            double entryPrice = position.entryPrice();
            double stopLossPercent = tradingHandler.getStopLossPercent();
            double takeProfitPercent = tradingHandler.getTakeProfitPercent();

            double stopLossPrice = entryPrice * (1 - stopLossPercent / 100.0);
            double takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100.0);

            logger.debug("STOP-LOSS MONITOR | token={} | entry={} | bestBid={} | SL={} | TP={}",
                    tokenId, entryPrice, bestBid, String.format("%.4f", stopLossPrice), String.format("%.4f", takeProfitPrice));

            if (bestBid <= stopLossPrice) {
                logger.warn("STOP-LOSS TRIGGERED | token={} | entry={} | bestBid={} | threshold={}%",
                        tokenId, entryPrice, bestBid, stopLossPercent);
                executeSell(tokenId, position, bestBid, "STOP_LOSS");
            } else if (bestBid >= takeProfitPrice) {
                logger.warn("TAKE-PROFIT TRIGGERED | token={} | entry={} | bestBid={} | threshold={}%",
                        tokenId, entryPrice, bestBid, takeProfitPercent);
                executeSell(tokenId, position, bestBid, "TAKE_PROFIT");
            }
        } catch (Exception e) {
            logger.error("Error processing CLOB book message for token {}: {}", tokenId, e.getMessage());
        }
    }

    private void executeSell(String tokenId, PositionManager.Position position, double bestBid, String reason) {
        String label = String.format("%s SELL | token=%s | bestBid=%s", reason, tokenId, bestBid);
        boolean success = RetryExecutor.execute(label,
                () -> orderService.placeSellOrder(position.blockId(), tokenId, position.shares(), bestBid));

        if (success) {
            positionManager.closePosition(tokenId, reason, bestBid);
        } else {
            positionManager.closePosition(tokenId, reason + "_FAILED", bestBid);
        }
        unsubscribe(tokenId);
    }
}
