package com.claudiordese.library.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "roles", schema = "public", uniqueConstraints = {
        @UniqueConstraint(name = "roles_idx_1",columnNames = {"username","role"})
})
public class Role {

    @Setter
    @ManyToOne
    @JoinColumn(name = "username", referencedColumnName = "username", nullable = false)
    private Player player;

    @Setter
    @Column(name = "role")
    private String role;

    @Setter
    @Getter
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;
}
