package com.claudiordese.chat.application.domain.event.server;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Value;

/**
 * A conversation's membership changed (group created, someone added or removed, group
 * deleted). Carries no member data: the client reloads its conversation list, which
 * is where names and pictures are resolved.
 */
@Value
public final class MembersChangedEvent implements ServerEvent {
    String conversationId;

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.MEMBERS_CHANGED;
    }
}
