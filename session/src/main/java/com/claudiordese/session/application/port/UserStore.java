package com.claudiordese.session.application.port;

import com.claudiordese.session.application.domain.User;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface UserStore {

    Optional<User> findById(UUID id);
    List<User> findByIds(List<UUID> ids);
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    User create(String username, String email, String passwordHash);
    User update(User user);
    List<User> searchByUsername(String usernameQuery, int page, int size);

    /** Names of every role definition that can be assigned. */
    List<String> findAllRoleNames();

    /** Replaces the user's role assignments with exactly {@code roleNames}. */
    User updateRoles(UUID userId, Set<String> roleNames);
}
