package com.claudiordese.session.infrastructure.controllers.request.server;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Create a new server owned by the current user.")
public record CreateServerRequest(

        @NotBlank
        @Size(min = 2, max = 50, message = "server name must be 2-50 characters")
        @Schema(description = "Display name of the server.", example = "Yapster Hangout")
        String name) {}
