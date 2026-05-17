package com.claudiordese.session.controllers.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateUsernameRequest(
        @NotBlank
        @Size(min = 3, max = 30)
        String newUsername
) {}
