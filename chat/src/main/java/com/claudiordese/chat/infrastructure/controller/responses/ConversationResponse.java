package com.claudiordese.chat.infrastructure.controller.responses;

import com.claudiordese.chat.application.domain.chat.Conversation;

import java.util.UUID;

public record ConversationResponse(UUID id, String type, String name) {

    public static ConversationResponse of(Conversation c) {
        return new ConversationResponse(c.id(), c.type().name(), c.name());
    }
}
