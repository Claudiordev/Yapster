package com.claudiordese.session.support;

import com.claudiordese.session.application.domain.Role;
import com.claudiordese.session.application.domain.User;
import com.claudiordese.session.application.port.UserStore;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public class InMemoryUserStore implements UserStore {

    private final Map<UUID, User> byId = new HashMap<>();

    @Override
    public Optional<User> findById(UUID id) {
        return Optional.ofNullable(byId.get(id));
    }

    @Override
    public Optional<User> findByUsername(String username) {
        return byId.values().stream().filter(u -> u.username().equals(username)).findFirst();
    }

    @Override
    public boolean existsByUsername(String username) {
        return findByUsername(username).isPresent();
    }

    @Override
    public boolean existsByEmail(String email) {
        return byId.values().stream().anyMatch(u -> u.email().equals(email));
    }

    @Override
    public User create(String username, String email, String passwordHash) {
        User user = new User(UUID.randomUUID(), username, email, passwordHash,
                Set.of(new Role("USER")), Optional.empty());
        byId.put(user.id(), user);
        return user;
    }

    @Override
    public User update(User user) {
        byId.put(user.id(), user);
        return user;
    }

    @Override
    public List<User> searchByUsername(String fragment) {
        String needle = fragment.toLowerCase(Locale.ROOT);
        return byId.values().stream()
                .filter(u -> u.username().toLowerCase(Locale.ROOT).contains(needle))
                .sorted((a, b) -> a.username().compareToIgnoreCase(b.username()))
                .limit(20)
                .toList();
    }
}
