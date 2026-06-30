package com.claudiordese.session.infrastructure.controllers.request.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdatePasswordRequest(
        @NotBlank
        String currentPassword,

        @NotBlank
        @Size(min = 8)
        String newPassword
) {}
