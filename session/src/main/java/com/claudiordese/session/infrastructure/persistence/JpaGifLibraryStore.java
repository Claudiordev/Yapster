package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.application.domain.GifFavorite;
import com.claudiordese.session.application.domain.GifFolder;
import com.claudiordese.session.application.port.GifLibraryStore;
import com.claudiordese.session.infrastructure.entity.GifFavoriteEntity;
import com.claudiordese.session.infrastructure.entity.GifFolderEntity;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
public class JpaGifLibraryStore implements GifLibraryStore {

    private final GifFolderRepository folders;
    private final GifFavoriteRepository favorites;

    public JpaGifLibraryStore(GifFolderRepository folders, GifFavoriteRepository favorites) {
        this.folders = folders;
        this.favorites = favorites;
    }

    @Override
    public List<GifFolder> folders(UUID userId) {
        return folders.findByUserIdOrderByDefaultFolderDescCreatedAtAsc(userId).stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<GifFolder> folder(UUID userId, UUID folderId) {
        return folders.findByIdAndUserId(folderId, userId).map(this::toDomain);
    }

    @Override
    public GifFolder createFolder(UUID userId, String name, boolean isDefault) {
        GifFolderEntity entity = new GifFolderEntity();

        entity.setId(UUID.randomUUID());
        entity.setUserId(userId);
        entity.setName(name);
        entity.setDefaultFolder(isDefault);

        return toDomain(folders.save(entity));
    }

    @Override
    public void renameFolder(UUID folderId, String name) {
        folders.findById(folderId).ifPresent(entity -> {
            entity.setName(name);
            folders.save(entity);
        });
    }

    @Override
    public void deleteFolder(UUID folderId) {
        // Its gif_favorites rows go with it (ON DELETE CASCADE).
        folders.deleteById(folderId);
    }

    @Override
    public List<GifFavorite> gifs(UUID folderId, String query) {
        return favorites.search(folderId, query).stream()
                .map(g -> new GifFavorite(g.getGifId(), g.getTitle(), g.getPreviewUrl(), g.getUrl(), g.getCreatedAt()))
                .toList();
    }

    @Override
    public Map<String, List<UUID>> memberships(UUID userId) {
        Map<String, List<UUID>> result = new LinkedHashMap<>();

        for (Object[] row : favorites.membershipRows(userId)) {
            result.computeIfAbsent((String) row[0], k -> new ArrayList<>()).add((UUID) row[1]);
        }

        return result;
    }

    @Override
    public int distinctGifCount(UUID userId) {
        return (int) favorites.distinctGifCount(userId);
    }

    @Override
    public boolean hasGif(UUID userId, String gifId) {
        return favorites.userHasGif(userId, gifId);
    }

    @Override
    public void addGif(UUID folderId, GifFavorite gif) {
        if (favorites.existsByFolderIdAndGifId(folderId, gif.gifId())) return;

        GifFavoriteEntity entity = new GifFavoriteEntity();

        entity.setId(UUID.randomUUID());
        entity.setFolderId(folderId);
        entity.setGifId(gif.gifId());
        entity.setTitle(gif.title());
        entity.setPreviewUrl(gif.previewUrl());
        entity.setUrl(gif.url());
        favorites.save(entity);
    }

    @Override
    public void removeGif(UUID folderId, String gifId) {
        favorites.deleteByFolderIdAndGifId(folderId, gifId);
    }

    private GifFolder toDomain(GifFolderEntity entity) {
        return new GifFolder(entity.getId(), entity.getUserId(), entity.getName(), entity.isDefaultFolder(),
                (int) favorites.countByFolderId(entity.getId()));
    }
}
