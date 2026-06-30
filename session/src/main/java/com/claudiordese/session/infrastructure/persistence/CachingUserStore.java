package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.application.domain.User;
import com.claudiordese.session.application.port.UserStore;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Caching decorator around {@link JpaUserStore}. Implements the same
 * {@link UserStore} port and wraps the real one, adding a Redis cache on
 * by-id lookups and evicting it whenever the user changes.
 *
 * Marked {@link Primary} so anything depending on {@code UserStore} gets this
 * (the caching layer), wired in transparently — {@code UserService} stays
 * framework-free and unaware caching exists. Because this is a separate bean
 * from the service, the cache also applies to lookups the service makes
 * internally (resolving a user during another operation), which a
 * service-level annotation couldn't do (self-invocation bypasses the proxy).
 *
 * Every mutation ({@code update}) evicts the user's entry, keyed by the same
 * UUID the cache uses — so the cached value is never stale.
 */
@Primary
@Component
public class CachingUserStore implements UserStore {

    static final String USERS_CACHE = "users";

    private final UserStore delegate;

    // Inject the CONCRETE JpaUserStore, not the UserStore interface
    // the interface would resolve to this @Primary bean and wrap itself.
    public CachingUserStore(JpaUserStore delegate) {
        this.delegate = delegate;
    }

    @Override
    // Spring unwraps Optional return values before evaluating SpEL, so #result is
    // the bare User (or null when the Optional is empty) — never the Optional. Guard
    // on null so a miss isn't cached; "#result.isEmpty()" would call User.isEmpty().
    @Cacheable(value = USERS_CACHE, key = "#id", unless = "#result == null")
    public Optional<User> findById(UUID id) {
        return delegate.findById(id);
    }

    @Override
    @CacheEvict(value = USERS_CACHE, key = "#user.id()")
    public User update(User user) {
        return delegate.update(user);
    }

    // ── pass-through: not cached ──────────────────────────────────────────────

    @Override
    public Optional<User> findByUsername(String username) {
        return delegate.findByUsername(username);
    }

    @Override
    public boolean existsByUsername(String username) {
        return delegate.existsByUsername(username);
    }

    @Override
    public boolean existsByEmail(String email) {
        return delegate.existsByEmail(email);
    }

    @Override
    public User create(String username, String email, String passwordHash) {
        return delegate.create(username, email, passwordHash);
    }

    @Override
    public List<User> searchByUsername(String fragment) {
        return delegate.searchByUsername(fragment);
    }
}
