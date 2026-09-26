package com.claudiordese.chat.infrastructure.controller.responses;

import com.claudiordese.chat.application.domain.chat.Message;

import com.claudiordese.chat.application.domain.chat.types.MessageType;
import com.claudiordese.chat.application.domain.chat.types.SystemEvent;

import java.time.Instant;
import java.util.UUID;

public record MessageResponse(UUID id, UUID conversationId, UUID senderId, String body, Instant sentAt, long seq,
                              MessageType messageType, SystemEvent systemEvent, UUID subjectId) {

    public static MessageResponse of(Message message) {
        return new MessageResponse(
                message.id(),
                message.conversationId(),
                message.senderId(),
                message.body(),
                message.sentAt(),
                message.seq(),
                message.type(),
                message.systemEvent(),
                message.subjectId()
        );
    }
}
