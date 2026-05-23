package com.claudiordese.session.application.port;

import com.claudiordese.session.application.domain.RefreshToken;

import java.time.Duration;
import java.util.Optional;

public interface RefreshTokenStore {

    RefreshToken issueFor(String username, Duration ttl);

    Optional<RefreshToken> findByValue(String value);

    void revoke(RefreshToken token);

    void delete(RefreshToken token);
}
