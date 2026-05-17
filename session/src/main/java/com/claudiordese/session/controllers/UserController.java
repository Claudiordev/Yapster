package com.claudiordese.session.controllers;

import com.claudiordese.session.controllers.request.UpdatePasswordRequest;
import com.claudiordese.session.controllers.request.UpdateUsernameRequest;
import com.claudiordese.session.dto.UserDto;
import com.claudiordese.session.service.UserService;
import com.claudiordese.session.service.commands.UpdatePasswordCommand;
import com.claudiordese.session.service.commands.UpdateUsernameCommand;
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
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("${url.api.base-path}/user")
@Tag(name = "User settings", description = "Operations for the currently authenticated user.")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    @GetMapping
    @Operation(summary = "Get the current user's information")
    @ApiResponse(responseCode = "200", description = "User information returned")
    @ApiResponse(responseCode = "401", description = "Not authenticated", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public UserDto details(Authentication authentication) {
        return userService.getUserById(AuthenticationUtils.currentUserId(authentication));
    }

    @GetMapping("/balance")
    @Operation(summary = "Get the current user's balance")
    @ApiResponse(responseCode = "200", description = "Balance returned")
    @ApiResponse(responseCode = "401", description = "Not authenticated", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public BigDecimal balance(Authentication authentication) {
        return userService.getBalanceById(AuthenticationUtils.currentUserId(authentication));
    }

    @PutMapping("/username")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Update the current user's username")
    @ApiResponse(responseCode = "204", description = "Username updated")
    @ApiResponse(responseCode = "401", description = "Not authenticated", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "409", description = "Username already in use", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public void updateUsername(Authentication authentication,
                               @Valid @RequestBody UpdateUsernameRequest request) {
        userService.updateUsername(
                new UpdateUsernameCommand(
                        AuthenticationUtils.currentUserId(authentication),
                        request.newUsername()
                ));
    }

    @PutMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Update the current user's password")
    @ApiResponse(responseCode = "204", description = "Password updated")
    @ApiResponse(responseCode = "401", description = "Not authenticated or current password incorrect", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public void updatePassword(Authentication authentication,
                               @Valid @RequestBody UpdatePasswordRequest request) {
        userService.updatePassword(
                new UpdatePasswordCommand(
                        AuthenticationUtils.currentUserId(authentication),
                        request.currentPassword(),
                        request.newPassword()
                ));
    }

}
