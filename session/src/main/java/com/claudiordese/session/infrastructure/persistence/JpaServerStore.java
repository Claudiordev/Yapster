package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.application.domain.Server;
import com.claudiordese.session.application.port.ServerStore;
import com.claudiordese.session.infrastructure.entity.ServerEntity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Component
public class JpaServerStore implements ServerStore {

    private final ServerRepository repo;

    public JpaServerStore(ServerRepository repo) {
        this.repo = repo;
    }

    @Override
    @Transactional
    public Server create(String name, UUID ownerId) {
        ServerEntity entity = new ServerEntity();
        entity.setName(name);
        entity.setOwnerId(ownerId);
        entity.setMembers(new HashSet<>(Set.of(ownerId)));
        entity.setCreatedAt(Instant.now());
        return toDomain(repo.save(entity));
    }

    @Override
    public Optional<Server> findById(UUID id) {
        return repo.findById(id).map(JpaServerStore::toDomain);
    }

    @Override
    @Transactional
    public Server update(Server server) {
        ServerEntity entity = repo.findById(server.id())
                .orElseThrow(() -> new IllegalStateException("Server vanished: " + server.id()));
        entity.setName(server.name());
        entity.setMembers(new HashSet<>(server.members()));
        return toDomain(repo.save(entity));
    }

    @Override
    public List<Server> listByMember(UUID userId) {
        return repo.findAllByMember(userId).stream()
                .map(JpaServerStore::toDomain)
                .toList();
    }

    static Server toDomain(ServerEntity entity) {
        return new Server(
                entity.getId(),
                entity.getName(),
                entity.getOwnerId(),
                Set.copyOf(entity.getMembers()),
                entity.getCreatedAt());
    }
}
