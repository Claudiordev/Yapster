package com.claudiordese.session.application.domain;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public record User(
        UUID id,
        String username,
        String email,
        String passwordHash,
        Set<Role> roles,
        Optional<String> avatarUrl,
        Optional<String> bio
) {

    public User withUsername(String newUsername) {
        return new User(id, newUsername, email, passwordHash, roles, avatarUrl, bio);
    }

    public User withBio(String newBio) {
        return new User(id, username, email, passwordHash, roles, avatarUrl,
                Optional.ofNullable(newBio));
    }

    public User withPasswordHash(String newPasswordHash) {
        return new User(id, username, email, newPasswordHash, roles, avatarUrl, bio);
    }

    public User withAvatarUrl(String newAvatarUrl) {
        return new User(id, username, email, passwordHash, roles,
                Optional.ofNullable(newAvatarUrl), bio);
    }
}
