package com.claudiordese.chat.application.domain.event.client;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Value;

@Value
public final class TypingEvent implements ClientEvent {
    String conversationId;

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.TYPING;
    }
}
