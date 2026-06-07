package com.claudiordese.comms.infrastructure.controllers.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "Request to send an SMS via the configured provider.")
public record SendMessageRequest(

        @NotBlank
        @Pattern(regexp = "^\\+[1-9]\\d{1,14}$", message = "must be in E.164 format, e.g. +14155552671")
        @Schema(description = "Destination phone number in E.164 format.", example = "+14155552671")
        String receiver,

        @NotBlank
        @Size(max = 1600, message = "must be at most 1600 characters (10 SMS segments)")
        @Schema(description = "Body of the SMS message.", example = "Hello from comms!", maxLength = 1600)
        String message) {}
