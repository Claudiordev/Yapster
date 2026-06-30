package com.claudiordese.session.infrastructure.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.Instant;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Data
@Entity
@Table(name = "servers", schema = "public")
public class ServerEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    /**
     * Membership rows in the join table server_members(server_id, user_id).
     * LAZY — callers that need members fetch them explicitly via @EntityGraph
     * (see ServerRepository), so listing servers by name pays no join cost.
     */
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "server_members", joinColumns = @JoinColumn(name = "server_id"))
    @Column(name = "user_id", nullable = false)
    private Set<UUID> members = new HashSet<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ServerEntity that = (ServerEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
