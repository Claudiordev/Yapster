package com.claudiordese.session.infrastructure.controllers;

import com.claudiordese.session.application.service.GoogleAuthService;
import com.claudiordese.session.application.service.commands.GoogleLoginCommand;
import com.claudiordese.session.infrastructure.controllers.request.auth.GoogleLoginRequest;
import com.claudiordese.session.infrastructure.controllers.response.LinkedProviderResponse;
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
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("${url.api.base-path}/user/providers")
@Tag(name = "Linked accounts", description = "External logins (Google) linked to the current user.")
@SecurityRequirement(name = "bearerAuth")
public class UserProvidersController {

    private final GoogleAuthService googleAuthService;

    @GetMapping
    @Operation(summary = "List the current user's linked login providers")
    @ApiResponse(responseCode = "200", description = "Linked providers returned")
    public List<LinkedProviderResponse> list(Authentication authentication) {
        return googleAuthService.linkedProviders(AuthenticationUtils.currentUserId(authentication)).stream()
                .map(LinkedProviderResponse::of)
                .toList();
    }

    @PostMapping("/google")
    @Operation(summary = "Link a Google account", description = "Exchange the authorization code from Google's redirect and link that account to the current user. Issues no tokens.")
    @ApiResponse(responseCode = "200", description = "Linked")
    @ApiResponse(responseCode = "409", description = "The Google account belongs to another user, or one is already linked", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "503", description = "Google sign-in is not configured", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public LinkedProviderResponse linkGoogle(Authentication authentication,
                                             @Valid @RequestBody GoogleLoginRequest request) {
        return LinkedProviderResponse.of(googleAuthService.link(
                AuthenticationUtils.currentUserId(authentication),
                new GoogleLoginCommand(request.code(), request.redirectUri(), request.codeVerifier(),
                        request.nonce(), null)));
    }

    @DeleteMapping("/{provider}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Unlink a login provider", description = "Refused when it is the user's only way to sign in (no password and no other provider).")
    @ApiResponse(responseCode = "204", description = "Unlinked")
    @ApiResponse(responseCode = "404", description = "That provider is not linked", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "It is the only way to sign in", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public void unlink(Authentication authentication, @PathVariable String provider) {
        googleAuthService.unlink(AuthenticationUtils.currentUserId(authentication), provider);
    }
}
