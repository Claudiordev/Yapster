package com.claudiordese.chat.infrastructure.adapter.socket;

import com.claudiordese.chat.application.domain.event.ServerEvent;
import com.claudiordese.chat.application.port.socket.EventGateway;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Specific event socket gateway with concurrent sessions storage
 */
@Component
public class WebSocketEventGateway implements EventGateway {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventGateway.class);
    /**
     * Sessions are saved here, UUID userId (JWT Sub), Set of WebSocketSession
     */
    private final Map<String, Set<WebSocketSession>> sessions = new ConcurrentHashMap<>();
    private final ObjectMapper json;

    public WebSocketEventGateway(ObjectMapper json) {
        this.json = json;
    }

    public void register(String userId, WebSocketSession session) {
        sessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public void unregister(String userId, WebSocketSession session) {
        sessions.computeIfPresent(userId, (k, set) -> {
            set.remove(session);
            return set.isEmpty() ? null : set;
        });
    }

    @Override
    public boolean isOnline(String userId) {
        Set<WebSocketSession> set = sessions.get(userId);
        return set != null && !set.isEmpty();
    }

    /**
     * Resend server message to sockets of user id
     */
    @Override
    public void send(String userId, ServerEvent event) {
        Set<WebSocketSession> set = sessions.get(userId);
        if (set == null) return;

        //Parse ServerEvent to JSON
        String eventObj;
        try {
            eventObj = json.writeValueAsString(event);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot serialize event: " + event, e);
        }

        sendMessage(userId,eventObj,set);
    }

    private void sendMessage(String userId, String message, Set<WebSocketSession> sockets) {
        TextMessage socketMessage = new TextMessage(message);

        for (WebSocketSession s : sockets) {
            try {
                if (s.isOpen()) {
                    synchronized (s) {
                        s.sendMessage(socketMessage);
                    }
                }
            } catch (IOException e) {
                log.warn("Socket is stale {}: {}",userId, e.getMessage());
                //TODO Remove socket from set for that userId
            }
        }
    }

}
