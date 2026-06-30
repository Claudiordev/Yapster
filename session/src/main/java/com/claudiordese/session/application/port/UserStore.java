package com.claudiordese.session.application.port;

import com.claudiordese.session.application.domain.User;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserStore {

    Optional<User> findById(UUID id);
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    User create(String username, String email, String passwordHash);
    User update(User user);
    List<User> searchByUsername(String fragment);
}
