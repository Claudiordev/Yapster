package com.claudiordese.chat.application.domain.event.server;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Value;

/** Authoritative call state received from the voice service. */
@Value
public final class CallStatusEvent implements ServerEvent {
    String conversationId;
    boolean ongoing;
    int participantCount;

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.CALL_STATUS;
    }
}
