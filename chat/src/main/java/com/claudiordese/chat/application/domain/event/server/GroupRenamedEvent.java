package com.claudiordese.chat.application.domain.event.server;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Value;

/**
 * A group was renamed. {@code name} is the new name, or null when it was cleared (the
 * group is shown as its members again).
 */
@Value
public final class GroupRenamedEvent implements ServerEvent {
    String conversationId;
    String name;

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.GROUP_RENAMED;
    }
}
