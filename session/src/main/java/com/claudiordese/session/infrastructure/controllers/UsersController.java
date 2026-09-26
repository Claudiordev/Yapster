package com.claudiordese.session.infrastructure.controllers;

import com.claudiordese.session.application.service.UserService;
import com.claudiordese.session.dto.UpdateRolesRequest;
import com.claudiordese.session.dto.UserProfileDto;
import com.claudiordese.session.dto.UserSummaryDto;
import com.claudiordese.session.infrastructure.controllers.request.user.UserSearchRequest;
import com.claudiordese.session.util.AuthenticationUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Cross-user lookups — public profile info only. Self-service operations on
 * the *current* user live in {@link UserController} under /user.
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("${url.api.base-path}/users")
@Tag(name = "Users", description = "Look up other users.")
@SecurityRequirement(name = "bearerAuth")
public class UsersController {

    private final UserService userService;

    @GetMapping("/search")
    @Operation(summary = "Search users by username")
    @ApiResponse(responseCode = "200", description = "Matching users returned.")
    @ApiResponse(responseCode = "400", description = "Query missing/too long or bad paging.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "401", description = "Not authenticated.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public List<UserSummaryDto> search(Authentication authentication,
                                       @Valid UserSearchRequest request) {
        return userService.searchUsers(
                AuthenticationUtils.currentUserId(authentication),
                request.getQuery(), request.getPage(), request.getSize());
    }

    @GetMapping
    @Operation(summary = "Look up users by id (batch)")
    @ApiResponse(responseCode = "200", description = "Matching users returned; unknown ids omitted.")
    @ApiResponse(responseCode = "401", description = "Not authenticated.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public List<UserSummaryDto> byIds(@RequestParam(required = false) List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return userService.getUsersByIds(ids);
    }

    @GetMapping("/{userId}")
    @Operation(summary = "Get a user's public profile (avatar, bio, roles)")
    @ApiResponse(responseCode = "200", description = "Profile returned.")
    @ApiResponse(responseCode = "401", description = "Not authenticated.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "User not found.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public UserProfileDto profile(@PathVariable UUID userId) {
        return userService.getProfile(userId);
    }

    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "List all users, paged (admin only)")
    @ApiResponse(responseCode = "200", description = "Users returned, ordered by username, excluding the caller.")
    @ApiResponse(responseCode = "403", description = "Not an admin.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public List<UserSummaryDto> listAll(Authentication authentication,
                                        @RequestParam(defaultValue = "0") @Min(0) int page,
                                        @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        return userService.listUsers(AuthenticationUtils.currentUserId(authentication), page, size);
    }

    @GetMapping("/roles")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "List every assignable role (admin only)")
    @ApiResponse(responseCode = "200", description = "Role names returned.")
    @ApiResponse(responseCode = "403", description = "Not an admin.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public List<String> availableRoles() {
        return userService.availableRoles();
    }

    @PutMapping("/{userId}/roles")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Replace a user's roles (admin only)", description = "USER is always kept. An admin cannot remove their own ADMIN role. The user is notified in real time.")
    @ApiResponse(responseCode = "200", description = "Roles updated; the refreshed profile is returned.")
    @ApiResponse(responseCode = "400", description = "Unknown role name.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "403", description = "Not an admin, or removing your own ADMIN role.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "404", description = "User not found.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public UserProfileDto updateRoles(Authentication authentication, @PathVariable UUID userId, @Valid @RequestBody UpdateRolesRequest request) {
        return userService.updateRoles(
                AuthenticationUtils.currentUserId(authentication), userId, request.roles());
    }
}
