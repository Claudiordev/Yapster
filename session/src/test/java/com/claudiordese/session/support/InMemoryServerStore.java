package com.claudiordese.session.support;

import com.claudiordese.session.application.domain.Server;
import com.claudiordese.session.application.port.ServerStore;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public class InMemoryServerStore implements ServerStore {

    private final Map<UUID, Server> byId = new HashMap<>();

    @Override
    public Server create(String name, UUID ownerId) {
        Server server = new Server(UUID.randomUUID(), name, ownerId, Set.of(ownerId), Instant.now());
        byId.put(server.id(), server);
        return server;
    }

    @Override
    public Optional<Server> findById(UUID id) {
        return Optional.ofNullable(byId.get(id));
    }

    @Override
    public Server update(Server server) {
        byId.put(server.id(), server);
        return server;
    }

    @Override
    public List<Server> listByMember(UUID userId) {
        return byId.values().stream()
                .filter(s -> s.hasMember(userId))
                .toList();
    }
}
