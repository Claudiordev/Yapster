package com.claudiordese.chat.infrastructure.controller.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.Set;
import java.util.UUID;

public record CreateGroupRequest(
        @NotBlank
        @Size(max = 100)
        String groupName,

        // Other members besides the creator. Max group size is 15 (creator + 14).
        @NotEmpty
        @Size(max = 14)
        Set<UUID> memberIds
) {}
