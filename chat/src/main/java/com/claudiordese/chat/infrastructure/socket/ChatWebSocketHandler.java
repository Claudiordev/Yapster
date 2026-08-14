package com.claudiordese.chat.infrastructure.socket;

import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.application.domain.event.client.TypingEvent;
import com.claudiordese.chat.application.domain.event.server.UserStatusEvent;
import com.claudiordese.chat.application.domain.event.types.EventType;
import com.claudiordese.chat.application.service.ChatService;
import com.claudiordese.chat.infrastructure.adapter.socket.WebSocketEventGateway;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.UUID;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {
    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);
    private final WebSocketEventGateway gateway;
    private final ObjectMapper json;
    private final ChatService chatService;

    public ChatWebSocketHandler(WebSocketEventGateway gateway, ObjectMapper json, ChatService chatService) {
        this.gateway = gateway;
        this.json = json;
        this.chatService = chatService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String userId = (String) session.getAttributes().get("userId");

        boolean wasOffline = !gateway.isOnline(userId);

        gateway.register(userId,session);

        if (wasOffline) chatService.sendUserStatus(UUID.fromString(userId), UserStatusType.ONLINE);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String userId = (String) session.getAttributes().get("userId");

        gateway.unregister(userId, session);

        boolean isOffline = !gateway.isOnline(userId);

        if (isOffline) chatService.sendUserStatus(UUID.fromString(userId),UserStatusType.OFFLINE);

    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode payload = json.readTree(message.getPayload());
            EventType type = EventType.valueOf(payload.path("type").asText());

            String userId = (String) session.getAttributes().get("userId");

            switch (type) {
                case TYPING -> {
                    TypingEvent typingEvent = json.treeToValue(payload, TypingEvent.class);
                    chatService.sendTyping(UUID.fromString(typingEvent.getConversationId()),
                            UUID.fromString(userId));
                }
                case USER_STATUS_EVENT -> {
                    UserStatusEvent userStatusEvent = json.treeToValue(payload, UserStatusEvent.class);
                    chatService.sendUserStatus(UUID.fromString(userId),userStatusEvent.getUserStatusType());
                }
                default -> log.warn("unknown client event: {}", type);
            }
        } catch (Exception e) {
            log.warn("Error on socket frame from {}: {}",session.getAttributes().get("userId"), e.getMessage());
        }
    }
}
