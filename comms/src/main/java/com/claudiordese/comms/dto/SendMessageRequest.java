package com.claudiordese.comms.dto;

import jakarta.validation.constraints.NotBlank;

public record SendMessageRequest(@NotBlank String receiver, @NotBlank String message) {}
