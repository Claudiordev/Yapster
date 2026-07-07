package com.claudiordese.chat.application.domain.event;

import com.claudiordese.chat.application.domain.event.types.EventType;

public sealed interface ServerEvent permits MessageEvent {
    /**
     * @return event type
     */
    EventType type();
}
