package com.claudiordese.chat.application.domain.chat;

import com.claudiordese.chat.application.domain.chat.types.MessageType;
import com.claudiordese.chat.application.domain.chat.types.SystemEvent;

import java.time.Instant;
import java.util.UUID;

public record Message(
        UUID id,
        UUID conversationId, //FK
        UUID senderId, //JWT subject; null for SYSTEM messages
        String body, //message; empty for SYSTEM messages
        Instant sentAt,
        long seq, // strict increasing integer stamp to have reliable order of messages
        MessageType type,
        SystemEvent systemEvent, // only for SYSTEM messages
        UUID subjectId // user a SYSTEM message is about
        ) {

    public static Message user(UUID conversationId, UUID senderId, String body) {
        return new Message(UUID.randomUUID(), conversationId, senderId, body, Instant.now(), 0L,
                MessageType.USER, null, null);
    }

    public static Message system(UUID conversationId, SystemEvent event, UUID subjectId) {
        return new Message(UUID.randomUUID(), conversationId, null, "", Instant.now(), 0L,
                MessageType.SYSTEM, event, subjectId);
    }
}
