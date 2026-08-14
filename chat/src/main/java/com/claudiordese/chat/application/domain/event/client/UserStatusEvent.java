package com.claudiordese.chat.application.domain.event.client;

import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Value;

@Value
public final class UserStatusEvent implements ClientEvent {
    UserStatusType userStatusType;

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.USER_STATUS_EVENT;
    }
}
