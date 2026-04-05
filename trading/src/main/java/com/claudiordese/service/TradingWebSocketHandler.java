package com.claudiordese.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class TradingWebSocketHandler extends TextWebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(TradingWebSocketHandler.class);

    private final TradingHandler tradingHandler;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private Runnable onDisconnect;

    public TradingWebSocketHandler(TradingHandler tradingHandler) {
        this.tradingHandler = tradingHandler;
    }

    public void setOnDisconnect(Runnable onDisconnect) {
        this.onDisconnect = onDisconnect;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        logger.info("WebSocket connection established: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session,@NonNull TextMessage message) {
        try {
            JsonNode root = objectMapper.readTree(message.getPayload());
            JsonNode payload = root.get("payload");
            if (payload == null || payload.isEmpty()) return;

            double price = payload.get("value").asDouble();
            long timestampMs = payload.get("timestamp").asLong();
            tradingHandler.handle(price, timestampMs);
        } catch (Exception e) {
            logger.error("Error processing message: {}", e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        logger.warn("WebSocket connection closed: {} - {}", session.getId(), status);
        if (onDisconnect != null) {
            onDisconnect.run();
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        logger.error("WebSocket transport error: {}", exception.getMessage());
    }
}
