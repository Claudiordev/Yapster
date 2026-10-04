package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.application.domain.LinkedProvider;
import com.claudiordese.session.application.port.UserProviderStore;
import com.claudiordese.session.infrastructure.entity.UserProviderEntity;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class JpaUserProviderStore implements UserProviderStore {

    private final UserProviderRepository repo;

    public JpaUserProviderStore(UserProviderRepository repo) {
        this.repo = repo;
    }

    @Override
    public Optional<UUID> findUserId(String provider, String subject) {
        return repo.findByProviderAndSubject(provider, subject).map(UserProviderEntity::getUserId);
    }

    @Override
    public void link(UUID userId, String provider, String subject, String email) {
        UserProviderEntity entity = new UserProviderEntity();

        entity.setId(UUID.randomUUID());
        entity.setUserId(userId);
        entity.setProvider(provider);
        entity.setSubject(subject);
        entity.setEmail(email);
        repo.save(entity);
    }

    @Override
    public List<LinkedProvider> findByUser(UUID userId) {
        return repo.findByUserIdOrderByCreatedAtAsc(userId).stream()
                .map(entity -> new LinkedProvider(entity.getProvider(), entity.getEmail(), entity.getCreatedAt()))
                .toList();
    }

    @Override
    public boolean unlink(UUID userId, String provider) {
        return repo.deleteByUserIdAndProvider(userId, provider) > 0;
    }
}
