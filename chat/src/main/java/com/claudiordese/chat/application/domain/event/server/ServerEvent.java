package com.claudiordese.chat.application.domain.event.server;

import com.claudiordese.chat.application.domain.event.types.EventType;

public sealed interface ServerEvent permits MessageEvent, TypingEvent, UserStatusEvent {
    /**
     * @return event type
     */
    EventType type();
}
