package com.claudiordese.session.application.domain;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

public record User(
        UUID id,
        String username,
        String email,
        String passwordHash,
        BigDecimal balance,
        Set<String> roles
) {

    public User withUsername(String newUsername) {
        return new User(id, newUsername, email, passwordHash, balance, roles);
    }

    public User withPasswordHash(String newPasswordHash) {
        return new User(id, username, email, newPasswordHash, balance, roles);
    }
}
