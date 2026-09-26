package com.claudiordese.session.infrastructure.controllers;

import com.claudiordese.session.application.service.FeatureFlagService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping("${url.api.base-path}/features")
@Tag(name = "Feature flags", description = "Which platform features are switched on.")
@SecurityRequirement(name = "bearerAuth")
public class FeatureController {

    public record CreateFeatureRequest(String name, Boolean enabled) {}

    private final FeatureFlagService featureFlags;

    @GetMapping
    @Operation(summary = "Every feature and whether it is enabled", description = "Any signed-in user; clients read it at login.")
    @ApiResponse(responseCode = "200", description = "Feature name to enabled flag.")
    @ApiResponse(responseCode = "401", description = "Not authenticated.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public Map<String, Boolean> features() {
        return featureFlags.all();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Add a feature (admin only)", description = "Starts switched off unless enabled is true. The full set is returned.")
    @ApiResponse(responseCode = "201", description = "Created; the full set is returned.")
    @ApiResponse(responseCode = "400", description = "Invalid name (lower-case words joined by dashes, up to 64 characters).", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "403", description = "Not an admin.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "Feature already exists.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public Map<String, Boolean> create(@RequestBody CreateFeatureRequest request) {
        return featureFlags.create(request.name(), Boolean.TRUE.equals(request.enabled()));
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Switch features on or off (admin only)", description = "Body is a partial map of feature name to flag; the full set is returned.")
    @ApiResponse(responseCode = "200", description = "Updated; the full set is returned.")
    @ApiResponse(responseCode = "400", description = "Empty body, unknown feature, or non-boolean value.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "403", description = "Not an admin.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public Map<String, Boolean> update(@RequestBody Map<String, Boolean> changes) {
        return featureFlags.update(changes);
    }
}
