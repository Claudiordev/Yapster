package com.claudiordese.comms.application.service.result;

import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.domain.MessageStatus;

import java.time.Instant;
import java.util.UUID;

public record MessageResult(
        UUID id,
        String sender,
        String receiver,
        String body,
        MessageStatus status,
        String providerId,
        String price,
        String priceUnit,
        String errorMessage,
        Instant createdAt) {

    public static MessageResult from(Message message) {
        return new MessageResult(
                message.id(),
                message.sender(),
                message.receiver(),
                message.body(),
                message.status(),
                message.providerId().orElse(null),
                message.price().orElse(null),
                message.priceUnit().orElse(null),
                message.errorMessage().orElse(null),
                message.createdAt());
    }
}
