package com.claudiordese.session.infrastructure.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "feature_flags", schema = "public")
@Getter
@Setter
public class FeatureFlagEntity {

    @Id
    @Column(name = "name")
    private String name;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;
}
