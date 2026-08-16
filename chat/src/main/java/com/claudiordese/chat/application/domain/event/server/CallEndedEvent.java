package com.claudiordese.chat.application.domain.event.server;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Value;

/** Broadcast to every other member when someone leaves a call. */
@Value
public final class CallEndedEvent implements ServerEvent {
    String conversationId;
    String senderId;

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.CALL_ENDED;
    }
}
