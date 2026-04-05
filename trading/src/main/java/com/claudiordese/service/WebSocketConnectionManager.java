package com.claudiordese.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.WebSocketClient;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class WebSocketConnectionManager {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketConnectionManager.class);

    private static final String SUBSCRIPTION_JSON = """
            {
                "action": "subscribe",
                "subscriptions": [
                    {
                        "topic": "crypto_prices_chainlink",
                        "type": "update",
                        "filters": "{\\"symbol\\":\\"btc/usd\\"}"
                    }
                ]
            }
            """;

    private final WebSocketClient webSocketClient;
    private final TradingWebSocketHandler webSocketHandler;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    @Value("${trading.websocket.url}")
    private String websocketUrl;

    @Value("${trading.websocket.reconnect-interval-ms}")
    private long reconnectIntervalMs;

    private volatile WebSocketSession session;
    private final AtomicBoolean connected = new AtomicBoolean(false);

    public WebSocketConnectionManager(WebSocketClient webSocketClient, TradingWebSocketHandler webSocketHandler) {
        this.webSocketClient = webSocketClient;
        this.webSocketHandler = webSocketHandler;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        webSocketHandler.setOnDisconnect(() -> {
            connected.set(false);
            logger.warn("Connection lost, scheduling reconnect...");
            scheduleReconnect();
        });
        connect();
    }

    public void connect() {
        try {
            logger.info("Connecting to WebSocket: {}", websocketUrl);
            session = webSocketClient.execute(webSocketHandler, websocketUrl).get();
            connected.set(true);
            logger.info("Connected to WebSocket: {}", websocketUrl);
            subscribe();
        } catch (Exception e) {
            connected.set(false);
            logger.error("Failed to connect to WebSocket: {}", e.getMessage());
            scheduleReconnect();
        }
    }

    public void disconnect() {
        try {
            if (session != null && session.isOpen()) {
                session.close();
            }
            connected.set(false);
            logger.info("Disconnected from WebSocket");
        } catch (Exception e) {
            logger.error("Error disconnecting from WebSocket: {}", e.getMessage());
        }
    }

    public boolean isConnected() {
        return connected.get() && session != null && session.isOpen();
    }

    private void subscribe() {
        try {
            logger.info("Sending subscription: {}", SUBSCRIPTION_JSON);
            session.sendMessage(new TextMessage(SUBSCRIPTION_JSON));
            logger.info("Subscription sent successfully");
        } catch (Exception e) {
            logger.error("Failed to send subscription: {}", e.getMessage());
        }
    }

    private void scheduleReconnect() {
        logger.info("Scheduling reconnect in {} ms", reconnectIntervalMs);
        scheduler.schedule(this::connect, reconnectIntervalMs, TimeUnit.MILLISECONDS);
    }
}
