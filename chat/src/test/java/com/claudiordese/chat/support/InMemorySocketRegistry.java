package com.claudiordese.chat.support;

import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.infrastructure.adapter.socket.SocketRegistry;

import java.util.Collection;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Registry shared by several gateways in a test, standing in for Redis. */
public class InMemorySocketRegistry implements SocketRegistry {

    private final Map<String, Set<String>> connections = new ConcurrentHashMap<>();
    private final Map<String, UserStatusType> statuses = new ConcurrentHashMap<>();
    private volatile boolean failing;

    /** Simulates Redis being unreachable. */
    public void setFailing(boolean failing) {
        this.failing = failing;
    }

    /** Simulates the ttl running out for a replica that died without cleaning up. */
    public void expireAll() {
        connections.clear();
    }

    @Override
    public void add(String userId, String connectionId) {
        check();
        connections.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(connectionId);
    }

    @Override
    public void remove(String userId, String connectionId) {
        check();
        connections.computeIfPresent(userId, (k, set) -> {
            set.remove(connectionId);
            return set.isEmpty() ? null : set;
        });
    }

    @Override
    public void refresh(Map<String, ? extends Collection<String>> connectionsByUser) {
        check();
        connectionsByUser.forEach((userId, ids) ->
                connections.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).addAll(ids));
    }

    @Override
    public long connectionCount(String userId) {
        check();
        return connections.getOrDefault(userId, Set.of()).size();
    }

    @Override
    public int onlineUsers() {
        check();
        return connections.size();
    }

    @Override
    public int onlineDevices() {
        check();
        return connections.values().stream().mapToInt(Set::size).sum();
    }

    @Override
    public Optional<UserStatusType> status(String userId) {
        check();
        return Optional.ofNullable(statuses.get(userId));
    }

    @Override
    public boolean putStatus(String userId, UserStatusType status) {
        check();
        return statuses.put(userId, status) != status;
    }

    @Override
    public void clearStatus(String userId) {
        check();
        statuses.remove(userId);
    }

    public Set<String> connectionsOf(String userId) {
        return new HashSet<>(connections.getOrDefault(userId, Set.of()));
    }

    private void check() {
        if (failing) throw new IllegalStateException("redis down");
    }
}
