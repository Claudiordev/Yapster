package com.claudiordese.session.application.domain;

import java.util.Set;

/**
 * A role and the permissions it grants. A role may carry multiple permissions
 * (e.g. ADMIN → {MANAGE_SERVER, KICK_MEMBER}). Permissions are plain string
 * identifiers, defined in code.
 */
public record Role(String name, Set<String> permissions) {

    public Role {
        permissions = permissions == null ? Set.of() : Set.copyOf(permissions);
    }

    public Role(String name) {
        this(name, Set.of());
    }

    public boolean hasPermission(String permission) {
        return permissions.contains(permission);
    }
}
