package com.claudiordese.session.infrastructure.controllers.request.server;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

@Schema(description = "Add an existing user to a server. Owner-only.")
public record AddMemberRequest(

        @NotNull
        @Schema(description = "Id of the user to add.", example = "5f0e8e2a-1d3b-4f6c-9a2e-8b7c6d5e4f3a")
        UUID userId) {}
