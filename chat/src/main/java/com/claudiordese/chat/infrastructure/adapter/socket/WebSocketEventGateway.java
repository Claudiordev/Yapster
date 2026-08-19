package com.claudiordese.chat.infrastructure.adapter.socket;

import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.application.domain.event.server.ServerEvent;
import com.claudiordese.chat.application.port.socket.EventGateway;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;

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
    private final Map<String, UserStatusType> sessionsStatus = new ConcurrentHashMap<>();
    private final ObjectMapper json;
    private final Executor socketExecutor;

    public WebSocketEventGateway(ObjectMapper json, Executor socketExecutor) {
        this.json = json;
        this.socketExecutor = socketExecutor;
    }

    public void register(String userId, WebSocketSession session) {
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session, 2_000, 64 * 1024);
        sessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(safe);
    }

    public void unregister(String userId, WebSocketSession session) {
        sessions.computeIfPresent(userId, (k, set) -> {
            //there's no override of equals or hashcode in ConcurrentWebSocketSessionDecorator so just removing the set by the key string would always point to diffent objects
            //Using .getId() survives the wrapping since the value is present in the decorator and the real WebSocketSession as well, so removes the real decorator object present in the set
            set.removeIf(s -> s.getId().equals(session.getId()));
            return set.isEmpty() ? null : set;
        });

        if (!isOnline(userId)) sessionsStatus.remove(userId);
    }

    @Override
    public boolean isOnline(String userId) {
        Set<WebSocketSession> set = sessions.get(userId);
        return set != null && !set.isEmpty();
    }


    public UserStatusType statusOf(String userId) {
        return isOnline(userId) ? sessionsStatus.getOrDefault(userId, UserStatusType.ONLINE) : UserStatusType.OFFLINE;
    }

    /**
     * @return Number of online users
     */
    @Override
    public int onlineUsers() {
        return sessions.size();
    }

    /**
     * @return Number of online devices (one user, multiple devices)
     */
    @Override
    public int onlineDevices() {
        return sessions.values().stream().mapToInt(Set::size).sum();
    }

    @Override
    public boolean setStatus(String userId, UserStatusType status) {
        if (!isOnline(userId)) return false;
        return sessionsStatus.put(userId, status) != status;
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

        //Only one write happens per web socket existent (user + device) in the whole application
        //So independent of the request thread the request has to wait if it's
        //Being sent to the same user and same device
        for (WebSocketSession s : sockets) {
            socketExecutor.execute(() -> {
                try {
                    if (s.isOpen()) {
                        //SocketDecorator doesnt not need synchronized synce it's synchronized by default
                        s.sendMessage(socketMessage);
                        log.debug("Sending session={} on thread={}", s.getId(), Thread.currentThread().getName());
                    }
                } catch (Exception e) {
                    log.warn("Socket is stale {}: {}",userId, e.getMessage());
                    //One session might be stale or half-closed and so the unregister doesnt catch it
                    //So we force a close that then will call the unregister method
                    try {
                        s.close();
                    } catch (IOException ignored) {}
                }
            });
        }
    }

}
