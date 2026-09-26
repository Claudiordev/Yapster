package com.claudiordese.session.infrastructure.controllers.response.gif;

import com.claudiordese.session.application.service.result.GifLibraryResult;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Schema(description = "The user's GIF folders and which folders hold each saved GIF, with their limits.")
public record LibraryResponse(
        @Schema(description = "Folders, Favorites first.") List<FolderResponse> folders,
        @Schema(description = "GIF id to the ids of the folders that hold it.") Map<String, List<UUID>> memberships,
        @Schema(description = "Folders allowed beyond Favorites (0 without Premium).") int maxExtraFolders,
        @Schema(description = "Most GIFs the user may save in total.") int maxGifs) {

    public static LibraryResponse from(GifLibraryResult library) {
        return new LibraryResponse(
                library.folders().stream().map(FolderResponse::from).toList(),
                library.memberships(),
                library.maxExtraFolders(),
                library.maxGifs());
    }
}
