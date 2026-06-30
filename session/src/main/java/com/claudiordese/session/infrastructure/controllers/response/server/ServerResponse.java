package com.claudiordese.session.infrastructure.controllers.response.server;

import com.claudiordese.session.application.service.result.ServerResult;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@Schema(description = "A server the user owns or belongs to.")
public record ServerResponse(
        @Schema(description = "Server id.") UUID id,
        @Schema(description = "Display name.", example = "Yapster Hangout") String name,
        @Schema(description = "Id of the owning user.") UUID ownerId,
        @Schema(description = "Ids of all members, owner included.") Set<UUID> members,
        @Schema(description = "Creation timestamp.") Instant createdAt) {

    public static ServerResponse from(ServerResult result) {
        return new ServerResponse(result.id(), result.name(), result.ownerId(),
                result.members(), result.createdAt());
    }
}
