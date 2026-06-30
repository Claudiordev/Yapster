package com.claudiordese.session.infrastructure.controllers;

import com.claudiordese.session.application.service.UserService;
import com.claudiordese.session.dto.UserSummaryDto;
import com.claudiordese.session.util.AuthenticationUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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
    @Operation(summary = "Search users by username",
            description = "Case-insensitive contains-search, max 20 results, requester excluded. "
                    + "Returns public info only (id, username, avatar).")
    @ApiResponse(responseCode = "200", description = "Matching users returned.")
    @ApiResponse(responseCode = "400", description = "Query missing or too long.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "401", description = "Not authenticated.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public List<UserSummaryDto> search(Authentication authentication,
                                       @RequestParam("query")
                                       @NotBlank @Size(min = 1, max = 50) String query) {
        return userService.searchUsers(
                AuthenticationUtils.currentUserId(authentication), query);
    }
}
