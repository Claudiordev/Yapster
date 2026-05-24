package com.claudiordese.comms.infrastructure.controllers.request;

import jakarta.validation.constraints.NotBlank;

public record SendMessageRequest(@NotBlank String receiver, @NotBlank String message) {}
