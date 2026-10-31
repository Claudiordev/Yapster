package com.claudiordese.chat.infrastructure.controller.responses;

import com.claudiordese.chat.application.domain.chat.Message;
import com.claudiordese.chat.application.domain.chat.MessageWithReactions;

import com.claudiordese.chat.application.domain.chat.types.MessageType;
import com.claudiordese.chat.application.domain.chat.types.SystemEvent;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record MessageResponse(UUID id, UUID conversationId, UUID senderId, String body, Instant sentAt, long seq,
                              MessageType messageType, SystemEvent systemEvent, UUID subjectId,
                              List<ReactionResponse> reactions) {

    /** A message that has just been sent has no reactions yet. */
    public static MessageResponse of(Message message) {
        return of(message, List.of());
    }

    public static MessageResponse of(MessageWithReactions message) {
        return of(message.message(), message.reactions().stream().map(ReactionResponse::of).toList());
    }

    private static MessageResponse of(Message message, List<ReactionResponse> reactions) {
        return new MessageResponse(
                message.id(),
                message.conversationId(),
                message.senderId(),
                message.body(),
                message.sentAt(),
                message.seq(),
                message.type(),
                message.systemEvent(),
                message.subjectId(),
                reactions
        );
    }
}
