package com.claudiordese.chat.application.domain.event.client;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Value;

/** Sent by whoever starts (or joins, if already active) a voice call. */
@Value
public final class CallStartedEvent implements ClientEvent {
    String conversationId;

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.CALL_STARTED;
    }
}
