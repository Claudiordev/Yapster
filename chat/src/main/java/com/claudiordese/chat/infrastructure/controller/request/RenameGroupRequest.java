package com.claudiordese.chat.infrastructure.controller.request;

import jakarta.validation.constraints.Size;

/** A null or blank name clears the group's name. */
public record RenameGroupRequest(
        @Size(max = 100)
        String name
) {}
