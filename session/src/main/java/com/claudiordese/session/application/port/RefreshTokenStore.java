package com.claudiordese.session.application.port;

import com.claudiordese.session.application.domain.RefreshToken;

import java.time.Duration;
import java.util.Optional;

public interface RefreshTokenStore {

    RefreshToken issueFor(String username, Duration ttl);

    Optional<RefreshToken> findByValue(String value);

    void revoke(RefreshToken token);

    void delete(RefreshToken token);

    /**
     * Atomically consume (delete) the given token. Returns {@code true} if this call
     * removed the row, {@code false} if it was already gone — e.g. a concurrent
     * refresh already rotated it. This is the primitive that makes token rotation
     * race-safe: only the caller that gets {@code true} may issue a new token pair.
     */
    boolean consume(RefreshToken token);
}
