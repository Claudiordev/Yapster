package com.claudiordese.chat.infrastructure.adapter.socket;

import com.claudiordese.chat.application.domain.chat.types.UserStatusType;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;

/**
 * Cluster-wide view of who is connected, shared by every replica of the chat service.
 * Each replica still owns the real {@code WebSocketSession}s, this only knows their ids.
 */
public interface SocketRegistry {

    void add(String userId, String connectionId);

    void remove(String userId, String connectionId);

    /**
     * Heartbeat: extends the lifetime of the connections this replica still holds
     * and re-creates them if the shared store lost them.
     *
     * @param connectionsByUser user id to the ids of its connections held by this replica
     */
    void refresh(Map<String, ? extends Collection<String>> connectionsByUser);

    /** Live connections of the user across all replicas. */
    long connectionCount(String userId);

    int onlineUsers();

    int onlineDevices();

    Optional<UserStatusType> status(String userId);

    /** @return true when the stored status changed */
    boolean putStatus(String userId, UserStatusType status);

    void clearStatus(String userId);
}
