package com.claudiordese.comms.infrastructure.controllers.response;

import com.claudiordese.comms.application.service.result.MessageResult;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Outcome returned by the provider after we hand off the message.")
public record MessageResponse(

        @Schema(description = "Provider-assigned message ID (e.g. Twilio SID).",
                example = "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
        String providerId,

        @Schema(description = "Raw provider status string at the moment of acceptance.",
                example = "queued",
                allowableValues = {"queued", "accepted", "sending", "sent", "failed"})
        String status,

        @Schema(description = "Per-message price quoted by the provider (may be null until billing settles).",
                example = "0.0075")
        String price,

        @Schema(description = "ISO currency code matching `price`.",
                example = "USD")
        String priceUnit) {

    public static MessageResponse from(MessageResult result) {
        return new MessageResponse(
                result.providerId(),
                result.status(),
                result.price(),
                result.priceUnit());
    }
}
