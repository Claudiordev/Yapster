package com.claudiordese.library.model.entity;

import jakarta.persistence.*;
import jakarta.transaction.Transactional;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "players", schema = "public")
public class Player {
    @PrePersist
    public void prePersist() {
        Role role = new Role();
        role.setRole("ROLE_USER");
        role.setPlayer(this);

        this.roles.add(role);
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "username", nullable = false, length = 50, unique = true)
    private String username;

    @Column(name = "password", nullable = false, length = 68)
    private String password;

    @ColumnDefault("1")
    @Column( name = "enabled", nullable = false)
    private int enabled = 1;

    @ColumnDefault("0")
    @Column(name = "game_points", nullable = false)
    private Integer gamePoints = 0;

    @ColumnDefault("0")
    @Column(name = "score", nullable = false)
    private Integer score = 0;

    @ManyToMany(fetch = FetchType.LAZY, cascade = CascadeType.ALL, mappedBy = "players")
    private List<Tournament> tournaments;

    @OneToMany(mappedBy = "player", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MoveEntity> moveList;

    @OneToMany(mappedBy = "player", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Role> roles = new ArrayList<>();

    @ColumnDefault("now()")
    @Column(name = "created_at")
    private Instant createdAt;

    @ColumnDefault("now()")
    @Column(name = "updated_at")
    private Instant updatedAt;

}