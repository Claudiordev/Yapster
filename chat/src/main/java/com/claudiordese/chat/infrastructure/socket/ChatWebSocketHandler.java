package com.claudiordese.chat.infrastructure.socket;

import com.claudiordese.chat.infrastructure.adapter.socket.WebSocketEventGateway;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {
    private final WebSocketEventGateway gateway;

    public ChatWebSocketHandler(WebSocketEventGateway gateway) {
        this.gateway = gateway;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        gateway.register((String) session.getAttributes().get("userId"), session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        gateway.unregister((String) session.getAttributes().get("userId"), session);
    }
}
