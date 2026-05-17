package com.claudiordese.session.entity;

import jakarta.persistence.*;
import lombok.Setter;

@Entity
@Table(name = "roles", schema = "public", uniqueConstraints = {
        @UniqueConstraint(name = "roles_idx_1", columnNames = {"user_id","role"})
})
public class Role {

    @Setter
    @ManyToOne
    @JoinColumn(name = "user_id", referencedColumnName = "id", nullable = false)
    private User user;

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @Setter
    @Column(name = "role")
    private String role;
}
