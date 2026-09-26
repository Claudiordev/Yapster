package com.claudiordese.session.infrastructure.controllers.request.gif;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Create or rename a GIF folder.")
public record FolderRequest(

        @NotBlank
        @Size(max = 30, message = "folder name must be at most 30 characters")
        @Schema(description = "Folder name, unique per user ignoring case.", example = "Reactions")
        String name) {}
