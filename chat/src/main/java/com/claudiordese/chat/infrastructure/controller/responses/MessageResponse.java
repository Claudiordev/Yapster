package com.claudiordese.chat.infrastructure.controller.responses;

import com.claudiordese.chat.application.domain.chat.Message;

import java.time.Instant;
import java.util.UUID;

public record MessageResponse(UUID id, UUID conversationId, UUID senderId, String body, Instant sentAt, long seq) {

    public static MessageResponse of(Message message) {
        return new MessageResponse(
                message.id(),
                message.conversationId(),
                message.senderId(),
                message.body(),
                message.sentAt(),
                message.seq()
        );
    }
}
