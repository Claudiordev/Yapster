package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.application.port.RefreshTokenStore;
import com.claudiordese.session.application.domain.RefreshToken;
import com.claudiordese.session.infrastructure.entity.RefreshTokenEntity;
import com.claudiordese.session.infrastructure.repository.RefreshTokenRepository;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Component
public class JpaRefreshTokenStore implements RefreshTokenStore {

    private final RefreshTokenRepository repo;

    public JpaRefreshTokenStore(RefreshTokenRepository repo) {
        this.repo = repo;
    }

    @Override
    public RefreshToken issueFor(String username, Duration ttl) {
        RefreshTokenEntity entity =
                new RefreshTokenEntity();
        entity.setToken(UUID.randomUUID().toString());
        entity.setUsername(username);
        entity.setExpiryDate(Instant.now().plus(ttl));
        entity.setRevoked(false);
        return toDomain(repo.save(entity));
    }

    @Override
    public Optional<RefreshToken> findByValue(String value) {
        return repo.findByToken(value).map(JpaRefreshTokenStore::toDomain);
    }

    @Override
    public void revoke(RefreshToken token) {
        repo.findById(token.id()).ifPresent(entity -> {
            entity.setRevoked(true);
            repo.save(entity);
        });
    }

    @Override
    public void delete(RefreshToken token) {
        repo.deleteById(token.id());
    }

    static RefreshToken toDomain(RefreshTokenEntity entity) {
        return new RefreshToken(
                entity.getId(),
                entity.getToken(),
                entity.getUsername(),
                entity.getExpiryDate(),
                entity.isRevoked());
    }
}
