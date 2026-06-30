package com.claudiordese.session.application.domain;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * A user-created community. The owner is always a member; membership is by
 * user id (immutable surrogate key), never by username.
 */
public record Server(
        UUID id,
        String name,
        UUID ownerId,
        Set<UUID> members,
        Instant createdAt
) {

    public boolean isOwner(UUID userId) {
        return ownerId.equals(userId);
    }

    public boolean hasMember(UUID userId) {
        return members.contains(userId);
    }

    public Server withMember(UUID userId) {
        Set<UUID> updated = new HashSet<>(members);
        updated.add(userId);
        return new Server(id, name, ownerId, Set.copyOf(updated), createdAt);
    }
}
