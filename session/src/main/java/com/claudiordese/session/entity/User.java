package com.claudiordese.session.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.transaction.Transactional;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Entity
@Table(name="users", schema = "public")
public class User {
    @PrePersist
    public void prePersist() {
        Role role = new Role();
        role.setRole("USER");
        role.setUser(this);
        this.roles.add(role);
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id")
    private UUID id;

    @Column(name = "username", unique = true, nullable = false)
    private String username;

    @JsonIgnore
    @Column(name = "password", nullable = false)
    private String password;

    @Column(name = "enabled")
    private int enabled = 1;

    @OneToMany(mappedBy = "user")
    private List<Role> roles;
}
