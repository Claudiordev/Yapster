package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.BadRequestException;
import com.claudiordese.exceptions.ConflictException;
import com.claudiordese.exceptions.ForbiddenException;
import com.claudiordese.exceptions.NotFoundException;
import com.claudiordese.session.application.domain.GifFavorite;
import com.claudiordese.session.application.domain.GifFolder;
import com.claudiordese.session.application.domain.GifLibraryPolicy;
import com.claudiordese.session.application.port.GifLibraryStore;
import com.claudiordese.session.application.service.result.GifLibraryResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** A user's saved GIFs: the default Favorites folder for everyone, more folders for premium roles. */
@Service
@RequiredArgsConstructor
public class GifLibraryService {

    static final int MAX_FOLDER_NAME_LENGTH = 30;
    static final int MAX_TITLE_LENGTH = 120;
    static final int MAX_GIF_ID_LENGTH = 64;
    static final int MAX_URL_LENGTH = 500;
    static final String DEFAULT_FOLDER_NAME = "Favorites";

    private final GifLibraryStore store;

    /** Folders (Favorites first), which folders hold each saved GIF, and this user's limits. */
    @Transactional
    public GifLibraryResult library(UUID userId, Set<String> roles) {
        return new GifLibraryResult(
                foldersWithDefault(userId),
                store.memberships(userId),
                GifLibraryPolicy.maxExtraFolders(roles),
                GifLibraryPolicy.maxGifs(roles));
    }

    @Transactional
    public GifFolder createFolder(UUID userId, Set<String> roles, String rawName) {
        String name = cleanFolderName(rawName);
        List<GifFolder> folders = foldersWithDefault(userId);
        int limit = GifLibraryPolicy.maxExtraFolders(roles);

        if (limit == 0) {
            throw new ForbiddenException("gif_folders_premium", "Extra GIF folders are a Premium feature");
        }
        if (folders.stream().filter(folder -> !folder.isDefault()).count() >= limit) {
            throw new ForbiddenException("gif_folder_limit", "You can have up to " + limit + " extra GIF folders");
        }
        if (folders.stream().anyMatch(folder -> folder.name().equalsIgnoreCase(name))) {
            throw new ConflictException("gif_folder_exists", "You already have a folder called " + name);
        }

        return store.createFolder(userId, name, false);
    }

    @Transactional
    public void renameFolder(UUID userId, UUID folderId, String rawName) {
        String name = cleanFolderName(rawName);
        GifFolder folder = ownedFolder(userId, folderId);

        if (folder.isDefault()) {
            throw new BadRequestException("gif_folder_default", "The Favorites folder can't be renamed");
        }
        if (store.folders(userId).stream()
                .anyMatch(other -> !other.id().equals(folderId) && other.name().equalsIgnoreCase(name))) {
            throw new ConflictException("gif_folder_exists", "You already have a folder called " + name);
        }

        store.renameFolder(folderId, name);
    }

    /** Deletes the folder together with the GIFs in it. */
    @Transactional
    public void deleteFolder(UUID userId, UUID folderId) {
        if (ownedFolder(userId, folderId).isDefault()) {
            throw new BadRequestException("gif_folder_default", "The Favorites folder can't be deleted");
        }

        store.deleteFolder(folderId);
    }

    @Transactional(readOnly = true)
    public List<GifFavorite> gifs(UUID userId, UUID folderId, String query) {
        ownedFolder(userId, folderId);

        return store.gifs(folderId, query == null ? "" : query.trim());
    }

    @Transactional
    public void addGif(UUID userId, Set<String> roles, UUID folderId, String gifId, String title,
                       String previewUrl, String url) {
        ownedFolder(userId, folderId);
        GifFavorite gif = validGif(gifId, title, previewUrl, url);

        // Putting an already-saved GIF into another folder doesn't use up more of the allowance.
        if (!store.hasGif(userId, gif.gifId())
                && store.distinctGifCount(userId) >= GifLibraryPolicy.maxGifs(roles)) {
            throw new ForbiddenException("gif_limit",
                    "You can save up to " + GifLibraryPolicy.maxGifs(roles) + " GIFs");
        }

        store.addGif(folderId, gif);
    }

    @Transactional
    public void removeGif(UUID userId, UUID folderId, String gifId) {
        ownedFolder(userId, folderId);
        store.removeGif(folderId, gifId);
    }

    private List<GifFolder> foldersWithDefault(UUID userId) {
        List<GifFolder> folders = store.folders(userId);

        if (folders.stream().noneMatch(GifFolder::isDefault)) {
            store.createFolder(userId, DEFAULT_FOLDER_NAME, true);
            folders = store.folders(userId);
        }

        return folders;
    }

    private GifFolder ownedFolder(UUID userId, UUID folderId) {
        // Someone else's folder looks exactly like one that doesn't exist.
        return store.folder(userId, folderId)
                .orElseThrow(() -> new NotFoundException("gif_folder_not_found", "GIF folder not found"));
    }

    private static String cleanFolderName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");

        if (name.isEmpty() || name.length() > MAX_FOLDER_NAME_LENGTH || name.codePoints().anyMatch(Character::isISOControl)) {
            throw new BadRequestException("invalid_gif_folder_name",
                    "Folder names are 1 to " + MAX_FOLDER_NAME_LENGTH + " characters");
        }

        return name;
    }

    private static GifFavorite validGif(String gifId, String title, String previewUrl, String url) {
        if (gifId == null || gifId.isBlank() || gifId.length() > MAX_GIF_ID_LENGTH) {
            throw new BadRequestException("invalid_gif", "Invalid GIF id");
        }

        return new GifFavorite(
                gifId,
                truncate(title == null || title.isBlank() ? "GIF" : title.trim(), MAX_TITLE_LENGTH),
                allowedUrl(previewUrl),
                allowedUrl(url),
                Instant.now());
    }

    private static String allowedUrl(String raw) {
        try {
            URI uri = URI.create(raw == null ? "" : raw);

            if (raw.length() <= MAX_URL_LENGTH
                    && "https".equals(uri.getScheme())
                    && uri.getUserInfo() == null
                    && uri.getHost() != null
                    && GifLibraryPolicy.ALLOWED_HOSTS.contains(uri.getHost())) {
                return raw;
            }
        } catch (IllegalArgumentException ignored) {
            // falls through to the rejection below
        }

        throw new BadRequestException("invalid_gif_url", "GIF links must be https links to a supported GIF host");
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
