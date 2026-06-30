package com.claudiordese.session.application.port;

import com.claudiordese.session.application.domain.Server;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ServerStore {

    /** Persist a new server. The owner is registered as its first member. */
    Server create(String name, UUID ownerId);

    Optional<Server> findById(UUID id);

    /** Persist the current state (membership changes). */
    Server update(Server server);

    /** Every server the given user is a member of. */
    List<Server> listByMember(UUID userId);
}
