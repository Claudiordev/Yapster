package com.claudiordese.session.infrastructure.controllers;

import com.claudiordese.exceptions.BadRequestException;
import com.claudiordese.session.infrastructure.controllers.request.user.UpdatePasswordRequest;
import com.claudiordese.session.infrastructure.controllers.request.user.UpdateUsernameRequest;
import com.claudiordese.session.dto.UserDto;
import com.claudiordese.session.application.service.UserService;
import com.claudiordese.session.application.service.commands.UpdateAvatarCommand;
import com.claudiordese.session.application.service.commands.UpdatePasswordCommand;
import com.claudiordese.session.application.service.commands.UpdateUsernameCommand;
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
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

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

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Upload the current user's profile picture",
            description = "Multipart image upload; stored in object storage, the new URL is recorded.")
    @ApiResponse(responseCode = "204", description = "Avatar uploaded and set")
    @ApiResponse(responseCode = "400", description = "Missing file or not an image", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "401", description = "Not authenticated", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public void uploadAvatar(Authentication authentication,
                             @RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("empty_file", "No file was uploaded.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BadRequestException("not_an_image", "The uploaded file must be an image.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("unreadable_file", "Could not read the uploaded file.");
        }

        userService.updateAvatar(new UpdateAvatarCommand(
                AuthenticationUtils.currentUserId(authentication), bytes, contentType));
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
