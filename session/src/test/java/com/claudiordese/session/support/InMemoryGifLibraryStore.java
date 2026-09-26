package com.claudiordese.session.support;

import com.claudiordese.session.application.domain.GifFavorite;
import com.claudiordese.session.application.domain.GifFolder;
import com.claudiordese.session.application.port.GifLibraryStore;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public class InMemoryGifLibraryStore implements GifLibraryStore {

    private final Map<UUID, GifFolder> folders = new LinkedHashMap<>();
    private final Map<UUID, List<GifFavorite>> gifsByFolder = new LinkedHashMap<>();

    @Override
    public List<GifFolder> folders(UUID userId) {
        return folders.values().stream()
                .filter(folder -> folder.userId().equals(userId))
                .map(this::withCount)
                .sorted(Comparator.comparing((GifFolder folder) -> !folder.isDefault()))
                .toList();
    }

    @Override
    public Optional<GifFolder> folder(UUID userId, UUID folderId) {
        return Optional.ofNullable(folders.get(folderId))
                .filter(folder -> folder.userId().equals(userId))
                .map(this::withCount);
    }

    @Override
    public GifFolder createFolder(UUID userId, String name, boolean isDefault) {
        GifFolder folder = new GifFolder(UUID.randomUUID(), userId, name, isDefault, 0);

        folders.put(folder.id(), folder);
        gifsByFolder.put(folder.id(), new ArrayList<>());

        return folder;
    }

    @Override
    public void renameFolder(UUID folderId, String name) {
        GifFolder old = folders.get(folderId);

        folders.put(folderId, new GifFolder(old.id(), old.userId(), name, old.isDefault(), 0));
    }

    @Override
    public void deleteFolder(UUID folderId) {
        folders.remove(folderId);
        gifsByFolder.remove(folderId);
    }

    @Override
    public List<GifFavorite> gifs(UUID folderId, String query) {
        return gifsByFolder.getOrDefault(folderId, List.of()).stream()
                .filter(gif -> query.isEmpty() || gif.title().toLowerCase().contains(query.toLowerCase()))
                .sorted(Comparator.comparing(GifFavorite::createdAt).reversed())
                .toList();
    }

    @Override
    public Map<String, List<UUID>> memberships(UUID userId) {
        Map<String, List<UUID>> result = new LinkedHashMap<>();

        folders(userId).forEach(folder -> gifsByFolder.get(folder.id())
                .forEach(gif -> result.computeIfAbsent(gif.gifId(), k -> new ArrayList<>()).add(folder.id())));

        return result;
    }

    @Override
    public int distinctGifCount(UUID userId) {
        return memberships(userId).size();
    }

    @Override
    public boolean hasGif(UUID userId, String gifId) {
        return memberships(userId).containsKey(gifId);
    }

    @Override
    public void addGif(UUID folderId, GifFavorite gif) {
        List<GifFavorite> list = gifsByFolder.get(folderId);

        if (list.stream().noneMatch(existing -> existing.gifId().equals(gif.gifId()))) list.add(gif);
    }

    @Override
    public void removeGif(UUID folderId, String gifId) {
        gifsByFolder.get(folderId).removeIf(gif -> gif.gifId().equals(gifId));
    }

    private GifFolder withCount(GifFolder folder) {
        return new GifFolder(folder.id(), folder.userId(), folder.name(), folder.isDefault(),
                gifsByFolder.get(folder.id()).size());
    }
}
