package com.claudiordese.chat.application.domain.event.server;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.claudiordese.chat.application.domain.chat.types.MessageType;
import com.claudiordese.chat.application.domain.chat.types.SystemEvent;
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
    MessageType messageType;
    SystemEvent systemEvent;
    String subjectId;

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.MESSAGE;
    }
}
