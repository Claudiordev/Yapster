package com.claudiordese.session.application.domain;

import java.time.Instant;
import java.util.UUID;

public record RefreshToken(
        UUID id,
        String value,
        String username,
        Instant expiresAt,
        boolean revoked
) {
    public boolean isExpired(Instant now) {
        return expiresAt.isBefore(now);
    }
}
