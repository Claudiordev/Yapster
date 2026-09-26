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
@Table(name = "gif_favorites", schema = "public")
@Getter
@Setter
@NoArgsConstructor
public class GifFavoriteEntity {

    @Id
    private UUID id;

    @Column(name = "folder_id", nullable = false)
    private UUID folderId;

    @Column(name = "gif_id", nullable = false, length = 64)
    private String gifId;

    @Column(name = "title", nullable = false, length = 120)
    private String title;

    @Column(name = "preview_url", nullable = false, length = 500)
    private String previewUrl;

    @Column(name = "url", nullable = false, length = 500)
    private String url;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
