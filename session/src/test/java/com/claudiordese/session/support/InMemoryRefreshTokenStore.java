package com.claudiordese.session.support;

import com.claudiordese.session.application.domain.RefreshToken;
import com.claudiordese.session.application.port.RefreshTokenStore;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public class InMemoryRefreshTokenStore implements RefreshTokenStore {

    private final Map<UUID, RefreshToken> byId = new HashMap<>();

    @Override
    public RefreshToken issueFor(String username, Duration ttl) {
        RefreshToken token = new RefreshToken(
                UUID.randomUUID(),
                UUID.randomUUID().toString(),
                username,
                Instant.now().plus(ttl),
                false);
        byId.put(token.id(), token);
        return token;
    }

    @Override
    public Optional<RefreshToken> findByValue(String value) {
        return byId.values().stream().filter(t -> t.value().equals(value)).findFirst();
    }

    @Override
    public void revoke(RefreshToken token) {
        byId.put(token.id(), new RefreshToken(
                token.id(), token.value(), token.username(), token.expiresAt(), true));
    }

    @Override
    public void delete(RefreshToken token) {
        byId.remove(token.id());
    }

    public int size() {
        return byId.size();
    }
}
