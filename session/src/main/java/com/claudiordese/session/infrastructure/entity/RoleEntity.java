package com.claudiordese.session.infrastructure.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

/**
 * A role DEFINITION — defined once, shared across users (assigned via the
 * user_roles join table). Carries the permissions the role grants.
 */
@Entity
@Table(name = "roles", schema = "public")
public class RoleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Getter
    private Long id;

    @Getter
    @Setter
    @Column(name = "name", nullable = false, unique = true)
    private String name;

    /** Permissions this role grants — a role may hold several. */
    @Getter
    @Setter
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "role_permissions", joinColumns = @JoinColumn(name = "role_id"))
    @Column(name = "permission")
    private Set<String> permissions = new HashSet<>();

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RoleEntity that)) return false;
        return Objects.equals(name, that.name);   // name is the unique business key
    }

    @Override
    public int hashCode() {
        return Objects.hash(name);
    }
}
