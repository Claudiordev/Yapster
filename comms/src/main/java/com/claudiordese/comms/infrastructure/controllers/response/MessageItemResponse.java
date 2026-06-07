package com.claudiordese.comms.infrastructure.controllers.response;

import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.domain.MessageStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

@Schema(description = "A single SMS attempt within a conversation.")
public record MessageItemResponse(

        @Schema(description = "Message identifier (UUID).") UUID id,
        @Schema(description = "Message body.") String body,
        @Schema(description = "Final status as known to the comms service.")
        MessageStatus status,
        @Schema(description = "Provider-assigned message ID, if the provider accepted it.", nullable = true)
        String providerId,
        @Schema(description = "Reason the message could not be sent, if applicable.", nullable = true)
        String errorMessage,
        @Schema(description = "When the send was attempted (UTC).")
        Instant createdAt) {

    public static MessageItemResponse from(Message m) {
        return new MessageItemResponse(
                m.id(),
                m.body(),
                m.status(),
                m.providerId().orElse(null),
                m.errorMessage().orElse(null),
                m.createdAt());
    }
}
