package com.claudiordese.chat.application.domain.event.client;

import com.claudiordese.chat.application.domain.event.types.EventType;

/**
 * Events through sockets from UI
 */
public sealed interface ClientEvent permits TypingEvent,UserStatusEvent {
    EventType type();
}
