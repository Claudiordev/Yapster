package com.claudiordese.chat.application.domain.event.server;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Value;

/**
 * A user changed how they appear to others (profile picture or username). Sent to
 * everyone who shares a conversation with them; the client reloads its conversation
 * list to pick up the new name and picture.
 */
@Value
public final class ProfileChangedEvent implements ServerEvent {
    String userId;

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.PROFILE_CHANGED;
    }
}
