package com.claudiordese.session.application.service.result;

import com.claudiordese.session.application.domain.GifFolder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** A user's folders, which folders hold each saved GIF, and what their roles allow. */
public record GifLibraryResult(
        List<GifFolder> folders,
        Map<String, List<UUID>> memberships,
        int maxExtraFolders,
        int maxGifs) {}
