package com.claudiordese.session.application.port;

import com.claudiordese.session.application.domain.LinkedProvider;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Links users to external login providers (table user_providers). */
public interface UserProviderStore {

    Optional<UUID> findUserId(String provider, String subject);

    void link(UUID userId, String provider, String subject, String email);

    /** Everything linked to the user, oldest first. */
    List<LinkedProvider> findByUser(UUID userId);

    /** Removes the user's link to the provider; false when there was none. */
    boolean unlink(UUID userId, String provider);
}
