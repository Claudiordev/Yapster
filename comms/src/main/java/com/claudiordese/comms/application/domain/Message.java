package com.claudiordese.comms.application.domain;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public record Message(
        UUID id,
        String sender,
        String receiver,
        String body,
        MessageStatus status,
        Optional<String> providerId,
        Optional<String> price,
        Optional<String> priceUnit,
        Optional<String> errorMessage,
        Instant createdAt,
        Instant updatedAt) {

    public static Message queued(UUID id, String sender, String receiver, String body, Instant now) {
        return new Message(id, sender, receiver, body, MessageStatus.QUEUED,
                Optional.empty(), Optional.empty(), Optional.empty(),
                Optional.empty(), now, now);
    }

    public Message markSent(String providerId, String price, String priceUnit, Instant now) {
        return new Message(id, sender, receiver, body, MessageStatus.SENT,
                Optional.ofNullable(providerId), Optional.ofNullable(price),
                Optional.ofNullable(priceUnit), errorMessage, createdAt, now);
    }

    public Message markFailed(String reason, Instant now) {
        return new Message(id, sender, receiver, body, MessageStatus.FAILED,
                providerId, price, priceUnit, Optional.ofNullable(reason),
                createdAt, now);
    }
}
