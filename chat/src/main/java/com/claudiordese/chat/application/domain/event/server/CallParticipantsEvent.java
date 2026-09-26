package com.claudiordese.chat.application.domain.event.server;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Value;

import java.util.List;

/**
 * Who is currently in a conversation's call. Always the FULL current list, never a
 * join/leave delta, so a client just replaces what it shows. Empty means no call.
 */
@Value
public final class CallParticipantsEvent implements ServerEvent {
    String conversationId;
    List<String> userIds;

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.CALL_PARTICIPANTS;
    }
}
