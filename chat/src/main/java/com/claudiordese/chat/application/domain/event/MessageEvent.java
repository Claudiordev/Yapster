package com.claudiordese.chat.application.domain.event;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Value;

import java.time.Instant;

@Value
public final class MessageEvent implements ServerEvent {

    String id;
    long seq;
    String roomId;
    String senderId;
    String body;
    Instant sentAt;

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.MESSAGE;
    }
}
