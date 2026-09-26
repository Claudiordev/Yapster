package com.claudiordese.session.infrastructure.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "gif_folders", schema = "public")
@Getter
@Setter
@NoArgsConstructor
public class GifFolderEntity {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "name", nullable = false, length = 30)
    private String name;

    @Column(name = "is_default", nullable = false)
    private boolean defaultFolder;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
