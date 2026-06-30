package com.claudiordese.session.infrastructure.controllers;

import com.claudiordese.session.application.service.AuthService;
import com.claudiordese.session.infrastructure.controllers.request.auth.LoginRequest;
import com.claudiordese.session.infrastructure.controllers.request.auth.RegisterRequest;
import com.claudiordese.session.infrastructure.controllers.response.auth.TokenResponse;
import com.claudiordese.session.infrastructure.controllers.request.auth.RefreshTokenRequest;
import com.claudiordese.session.infrastructure.controllers.response.auth.RegisterResponse;
import com.claudiordese.session.application.service.commands.LoginCommand;
import com.claudiordese.session.application.service.commands.RegisterCommand;
import com.claudiordese.session.application.service.result.LoginResult;
import com.claudiordese.session.application.service.result.RegisterResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("${url.api.base-path}/auth")
public class AuthController {

    private final AuthService authService;

    @PostMapping
    @SecurityRequirements()
    @Operation(summary = "Log in", description = "Exchange username/password for an access token and a refresh token.")
    @ApiResponse(responseCode = "200", description = "Authenticated")
    @ApiResponse(responseCode = "401", description = "Invalid credentials", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest loginRequest) {
        LoginResult response = authService.login(new LoginCommand(loginRequest.username(), loginRequest.password()));

        return ResponseEntity.ok(new TokenResponse(response.accessToken(), response.refreshToken(), response.tokenType(), response.expiresIn()));
    }

    @PostMapping("/register")
    @SecurityRequirements()
    @Operation(summary = "Register a new user")
    @ApiResponse(responseCode = "201", description = "User created with success")
    @ApiResponse(responseCode = "409", description = "Username or email conflict")
    public ResponseEntity<RegisterResponse> registerUser(@Valid @RequestBody RegisterRequest registerRequest) {
        RegisterResult registerResult = authService.registerUser(
                new RegisterCommand(
                        registerRequest.username(),
                        registerRequest.email(),
                        registerRequest.confirmEmail(),
                        registerRequest.password()
                )
        );
        URI location = URI.create("/api/v1/user/" + registerResult.id());
        return ResponseEntity.created(location).body(new RegisterResponse(registerResult.id(), registerResult.username()));
    }

    @PostMapping("/refresh")
    @SecurityRequirements()
    @Operation(summary = "Refresh access token", description = "Exchange a refresh token for a new access token. Rotates the refresh token.")
    @ApiResponse(responseCode = "200", description = "New token pair issued")
    @ApiResponse(responseCode = "401", description = "Refresh token invalid, expired, or revoked", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public ResponseEntity<TokenResponse> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        LoginResult response = authService.refreshAccessToken(request.refreshToken());
        return ResponseEntity.ok(new TokenResponse(
                response.accessToken(), response.refreshToken(), response.tokenType(), response.expiresIn()));
    }

    @PostMapping("/logout")
    @SecurityRequirements()
    @Operation(summary = "Log out", description = "Revoke the supplied refresh token.")
    @ApiResponse(responseCode = "200", description = "Token revoked")
    @ApiResponse(responseCode = "401", description = "Refresh token not recognized", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshTokenRequest request) {
        authService.logout(request.refreshToken());
        return ResponseEntity.ok().build();
    }
}
