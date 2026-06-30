package com.claudiordese.session.infrastructure.controllers;

import com.claudiordese.session.application.service.ServerService;
import com.claudiordese.session.application.service.commands.AddServerMemberCommand;
import com.claudiordese.session.application.service.commands.CreateServerCommand;
import com.claudiordese.session.application.service.result.ServerResult;
import com.claudiordese.session.infrastructure.controllers.request.server.AddMemberRequest;
import com.claudiordese.session.infrastructure.controllers.request.server.CreateServerRequest;
import com.claudiordese.session.infrastructure.controllers.response.server.ServerResponse;
import com.claudiordese.session.util.AuthenticationUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("${url.api.base-path}/servers")
@Tag(name = "Servers", description = "User-created servers and their membership.")
@SecurityRequirement(name = "bearerAuth")
public class ServerController {

    private final ServerService serverService;

    @PostMapping
    @Operation(summary = "Create a server owned by the current user")
    @ApiResponse(responseCode = "201", description = "Server created; owner is its first member.")
    @ApiResponse(responseCode = "401", description = "Not authenticated.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public ResponseEntity<ServerResponse> create(Authentication authentication,
                                                 @Valid @RequestBody CreateServerRequest request) {
        ServerResult result = serverService.create(new CreateServerCommand(
                AuthenticationUtils.currentUserId(authentication),
                request.name()));

        return ResponseEntity
                .created(URI.create("/api/v1/servers/" + result.id()))
                .body(ServerResponse.from(result));
    }

    @PostMapping("/{serverId}/members")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Add a user to a server (owner only)")
    @ApiResponse(responseCode = "204", description = "Member added.")
    @ApiResponse(responseCode = "401", description = "Not authenticated.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "403", description = "Caller is not the server owner.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "Server or user not found.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "User is already a member.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public void addMember(Authentication authentication,
                          @PathVariable UUID serverId,
                          @Valid @RequestBody AddMemberRequest request) {
        serverService.addMember(new AddServerMemberCommand(
                serverId,
                AuthenticationUtils.currentUserId(authentication),
                request.userId()));
    }

    @GetMapping
    @Operation(summary = "List the servers the current user belongs to")
    @ApiResponse(responseCode = "200", description = "Servers returned.")
    @ApiResponse(responseCode = "401", description = "Not authenticated.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public List<ServerResponse> myServers(Authentication authentication) {
        return serverService.listFor(AuthenticationUtils.currentUserId(authentication)).stream()
                .map(ServerResponse::from)
                .toList();
    }
}
