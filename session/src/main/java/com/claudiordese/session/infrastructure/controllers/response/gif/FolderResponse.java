package com.claudiordese.session.infrastructure.controllers.response.gif;

import com.claudiordese.session.application.domain.GifFolder;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

@Schema(description = "One of the user's GIF folders.")
public record FolderResponse(
        @Schema(description = "Folder id.") UUID id,
        @Schema(description = "Display name.", example = "Favorites") String name,
        @Schema(description = "The built-in Favorites folder: it can't be renamed or deleted.") boolean isDefault,
        @Schema(description = "How many GIFs are in the folder.") int gifCount) {

    public static FolderResponse from(GifFolder folder) {
        return new FolderResponse(folder.id(), folder.name(), folder.isDefault(), folder.gifCount());
    }
}
