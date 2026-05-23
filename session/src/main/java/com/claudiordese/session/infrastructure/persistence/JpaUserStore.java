package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.application.domain.User;
import com.claudiordese.session.application.port.UserStore;
import com.claudiordese.session.infrastructure.entity.RoleEntity;
import com.claudiordese.session.infrastructure.entity.UserEntity;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class JpaUserStore implements UserStore {

    private final UserRepository repo;

    public JpaUserStore(UserRepository repo) {
        this.repo = repo;
    }

    @Override
    public Optional<User> findById(UUID id) {
        return repo.findById(id).map(JpaUserStore::toDomain);
    }

    @Override
    public Optional<User> findByUsername(String username) {
        return repo.findByUsername(username).map(JpaUserStore::toDomain);
    }
    @Override
    public boolean existsByUsername(String username) {
        return repo.findByUsername(username).isPresent();
    }

    @Override
    public boolean existsByEmail(String email) {
        return repo.findByEmail(email).isPresent();
    }

    @Override
    public User create(String username, String email, String passwordHash) {
        UserEntity entity = new UserEntity();
        entity.setUsername(username);
        entity.setEmail(email);
        entity.setPassword(passwordHash);
        return toDomain(repo.save(entity));
    }

    @Override
    public User update(User user) {
        UserEntity entity = repo.findById(user.id())
                .orElseThrow(() -> new IllegalStateException("User vanished: " + user.id()));
        entity.setUsername(user.username());
        entity.setEmail(user.email());
        entity.setPassword(user.passwordHash());
        return toDomain(repo.save(entity));
    }

    static User toDomain(UserEntity entity) {
        Set<String> roles = entity.getRoles() == null ? Set.of()
                : entity.getRoles().stream().map(RoleEntity::getRole).collect(Collectors.toSet());
        return new User(
                entity.getId(),
                entity.getUsername(),
                entity.getEmail(),
                entity.getPassword(),
                entity.getBalance(),
                roles);
    }
}
