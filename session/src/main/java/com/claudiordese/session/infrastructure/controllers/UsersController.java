package com.claudiordese.session.infrastructure.controllers;

import com.claudiordese.session.application.service.UserService;
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
import lombok.RequiredArgsConstructor;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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
}
