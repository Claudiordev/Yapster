package com.claudiordese.chat.infrastructure.adapter.socket;

import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.application.domain.event.server.ServerEvent;
import com.claudiordese.chat.application.port.socket.EventGateway;
import com.claudiordese.chat.infrastructure.configuration.SocketClusterProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Specific event socket gateway. The sessions themselves stay in this JVM; who is connected
 * (and with which status) lives in the {@link SocketRegistry}, and events for sockets held by
 * another replica travel through the {@link ClusterEventPublisher}.
 */
@Component
public class WebSocketEventGateway implements EventGateway {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventGateway.class);
    /**
     * Sessions held by THIS replica, UUID userId (JWT Sub), Set of WebSocketSession
     */
    private final Map<String, Set<WebSocketSession>> sessions = new ConcurrentHashMap<>();
    private final ObjectMapper json;
    private final Executor socketExecutor;
    private final SocketRegistry registry;
    private final ClusterEventPublisher cluster;
    private final String nodeId;
    private final Duration heartbeatInterval;
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "ws-registry-heartbeat");
        thread.setDaemon(true);
        return thread;
    });

    public WebSocketEventGateway(ObjectMapper json, Executor socketExecutor, SocketRegistry registry,
                                 ClusterEventPublisher cluster, SocketClusterProperties properties) {
        this.json = json;
        this.socketExecutor = socketExecutor;
        this.registry = registry;
        this.cluster = cluster;
        this.nodeId = properties.nodeId().isBlank() ? UUID.randomUUID().toString() : properties.nodeId();
        this.heartbeatInterval = properties.heartbeatInterval();
    }

    @PostConstruct
    void startHeartbeat() {
        heartbeat.scheduleWithFixedDelay(this::refreshRegistry, heartbeatInterval.toMillis(),
                heartbeatInterval.toMillis(), TimeUnit.MILLISECONDS);
    }

    /** Takes this replica's connections out of the shared view so users don't linger as online. */
    @PreDestroy
    void shutdown() {
        heartbeat.shutdownNow();
        sessions.forEach((userId, set) -> set.forEach(s -> {
            try {
                registry.remove(userId, connectionId(s));
            } catch (Exception e) {
                log.warn("Cannot unregister {} on shutdown: {}", userId, e.getMessage());
            }
        }));
    }

    void refreshRegistry() {
        try {
            Map<String, Set<String>> held = new HashMap<>();
            sessions.forEach((userId, set) -> {
                Set<String> ids = set.stream().map(this::connectionId).collect(Collectors.toSet());
                if (!ids.isEmpty()) held.put(userId, ids);
            });
            registry.refresh(held);
        } catch (Exception e) {
            log.warn("Socket registry heartbeat failed: {}", e.getMessage());
        }
    }

    public void register(String userId, WebSocketSession session) {
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session, 2_000, 64 * 1024);
        sessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(safe);

        try {
            registry.add(userId, connectionId(session));
        } catch (Exception e) {
            //The socket still works for this replica, the heartbeat publishes it once Redis is back
            log.warn("Cannot publish connection of {} to the registry: {}", userId, e.getMessage());
        }
    }

    public void unregister(String userId, WebSocketSession session) {
        sessions.computeIfPresent(userId, (k, set) -> {
            //there's no override of equals or hashcode in ConcurrentWebSocketSessionDecorator so just removing the set by the key string would always point to diffent objects
            //Using .getId() survives the wrapping since the value is present in the decorator and the real WebSocketSession as well, so removes the real decorator object present in the set
            set.removeIf(s -> s.getId().equals(session.getId()));
            return set.isEmpty() ? null : set;
        });

        try {
            registry.remove(userId, connectionId(session));
            if (!isOnline(userId)) registry.clearStatus(userId);
        } catch (Exception e) {
            log.warn("Cannot remove connection of {} from the registry: {}", userId, e.getMessage());
        }
    }

    /**
     * @return true when the user has a socket on ANY replica
     */
    @Override
    public boolean isOnline(String userId) {
        if (hasLocalSocket(userId)) return true;

        try {
            return registry.connectionCount(userId) > 0;
        } catch (Exception e) {
            log.warn("Registry unavailable, treating {} as offline: {}", userId, e.getMessage());
            return false;
        }
    }

    @Override
    public UserStatusType statusOf(String userId) {
        if (!isOnline(userId)) return UserStatusType.OFFLINE;

        try {
            return registry.status(userId).orElse(UserStatusType.ONLINE);
        } catch (Exception e) {
            log.warn("Registry unavailable, assuming {} is online: {}", userId, e.getMessage());
            return UserStatusType.ONLINE;
        }
    }

    /**
     * @return Number of online users across all replicas
     */
    @Override
    public int onlineUsers() {
        try {
            return registry.onlineUsers();
        } catch (Exception e) {
            log.warn("Registry unavailable, reporting this replica only: {}", e.getMessage());
            return sessions.size();
        }
    }

    /**
     * @return Number of online devices across all replicas (one user, multiple devices)
     */
    @Override
    public int onlineDevices() {
        try {
            return registry.onlineDevices();
        } catch (Exception e) {
            log.warn("Registry unavailable, reporting this replica only: {}", e.getMessage());
            return sessions.values().stream().mapToInt(Set::size).sum();
        }
    }

    @Override
    public boolean setStatus(String userId, UserStatusType status) {
        if (!isOnline(userId)) return false;

        try {
            return registry.putStatus(userId, status);
        } catch (Exception e) {
            log.warn("Cannot store status of {}: {}", userId, e.getMessage());
            return false;
        }
    }

    /**
     * Resend server message to the sockets of user id, on this replica and on every other one
     */
    @Override
    public void send(String userId, ServerEvent event) {
        long local = localCount(userId);
        long remote = remoteCount(userId, local);
        if (local == 0 && remote == 0) return;

        //Parse ServerEvent to JSON once, the other replicas get the same frame
        String eventObj;
        try {
            eventObj = json.writeValueAsString(event);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot serialize event: " + event, e);
        }

        if (local > 0) deliverLocal(userId, eventObj);

        if (remote > 0) {
            try {
                cluster.publish(new ClusterEnvelope(nodeId, userId, eventObj));
            } catch (Exception e) {
                log.warn("Cannot forward event to other replicas for {}: {}", userId, e.getMessage());
            }
        }
    }

    /**
     * Event published by another replica, write it to the sockets of the user held here
     */
    public void deliverFromCluster(ClusterEnvelope envelope) {
        if (nodeId.equals(envelope.origin())) return;

        deliverLocal(envelope.userId(), envelope.payload());
    }

    private void deliverLocal(String userId, String message) {
        Set<WebSocketSession> set = sessions.get(userId);
        if (set == null) return;

        sendMessage(userId, message, set);
    }

    private boolean hasLocalSocket(String userId) {
        return localCount(userId) > 0;
    }

    private long localCount(String userId) {
        Set<WebSocketSession> set = sessions.get(userId);
        return set == null ? 0 : set.size();
    }

    /**
     * Sockets of the user held by other replicas, 0 when Redis cannot tell
     */
    private long remoteCount(String userId, long local) {
        try {
            return Math.max(0, registry.connectionCount(userId) - local);
        } catch (Exception e) {
            log.warn("Registry unavailable, delivering to {} on this replica only: {}", userId, e.getMessage());
            return 0;
        }
    }

    private String connectionId(WebSocketSession session) {
        return nodeId + ":" + session.getId();
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
