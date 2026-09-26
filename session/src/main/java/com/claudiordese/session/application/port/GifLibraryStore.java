package com.claudiordese.session.application.port;

import com.claudiordese.session.application.domain.GifFavorite;
import com.claudiordese.session.application.domain.GifFolder;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Saved GIFs and the folders that hold them (tables gif_folders, gif_favorites). */
public interface GifLibraryStore {

    List<GifFolder> folders(UUID userId);

    Optional<GifFolder> folder(UUID userId, UUID folderId);

    GifFolder createFolder(UUID userId, String name, boolean isDefault);

    void renameFolder(UUID folderId, String name);

    /** Removes the folder and every GIF in it. */
    void deleteFolder(UUID folderId);

    /** GIFs in a folder, newest first, optionally only those whose title contains {@code query}. */
    List<GifFavorite> gifs(UUID folderId, String query);

    /** gifId to the folders holding it, for every GIF the user saved. */
    Map<String, List<UUID>> memberships(UUID userId);

    int distinctGifCount(UUID userId);

    boolean hasGif(UUID userId, String gifId);

    /** Idempotent: saving a GIF already in the folder changes nothing. */
    void addGif(UUID folderId, GifFavorite gif);

    void removeGif(UUID folderId, String gifId);
}
