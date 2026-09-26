package com.claudiordese.chat.application.domain.event.server;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Value;

/**
 * Sent to a single user when their roles were changed by an admin. Carries no
 * roles on purpose: it is only a signal, the client re-reads its own account.
 */
@Value
public final class RolesChangedEvent implements ServerEvent {

    @Override
    @JsonProperty("type")
    public EventType type() {
        return EventType.ROLES_CHANGED;
    }
}
