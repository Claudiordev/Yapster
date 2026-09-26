package com.claudiordese.session.application.port;

import java.util.Optional;
import java.util.UUID;

/** Links users to external login providers (table user_providers). */
public interface UserProviderStore {

    Optional<UUID> findUserId(String provider, String subject);

    void link(UUID userId, String provider, String subject, String email);
}
