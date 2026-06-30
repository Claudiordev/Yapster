package com.claudiordese.session.application.service.result;

import com.claudiordese.session.application.domain.Server;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record ServerResult(
        UUID id,
        String name,
        UUID ownerId,
        Set<UUID> members,
        Instant createdAt) {

    public static ServerResult from(Server server) {
        return new ServerResult(server.id(), server.name(), server.ownerId(),
                server.members(), server.createdAt());
    }
}
