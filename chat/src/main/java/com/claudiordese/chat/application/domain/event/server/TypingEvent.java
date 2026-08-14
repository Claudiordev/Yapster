package com.claudiordese.chat.application.domain.event.server;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Value;

@Value
public final class TypingEvent implements ServerEvent{
    String conversationId;
    String senderId;

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.TYPING;
    }
}
