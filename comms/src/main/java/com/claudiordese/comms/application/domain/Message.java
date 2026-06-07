package com.claudiordese.comms.application.domain;

import com.claudiordese.comms.application.service.commands.SendMessageCommand;
import com.claudiordese.comms.application.service.result.MessageResult;

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
        Instant createdAt) {

    public Message(UUID id, SendMessageCommand cmd, MessageResult result, Instant createdAt) {
        this(id, cmd.sender(), cmd.receiver(), cmd.body(), MessageStatus.valueOf(result.status().toUpperCase()),Optional.ofNullable(result.providerId()),Optional.ofNullable(result.price()), Optional.ofNullable(result.priceUnit()),Optional.empty(),createdAt);
    }

    public Message(UUID id, SendMessageCommand cmd, String errorMessage, Instant createdAt) {
        this(id, cmd.sender(), cmd.receiver(), cmd.body(), MessageStatus.FAILED, Optional.empty(), Optional.empty(), Optional.empty(), Optional.ofNullable(errorMessage), createdAt);
    }
}
