package com.claudiordese.chat.application.domain.chat;

import java.time.Instant;
import java.util.UUID;

public record Message(
        UUID id,
        UUID conversationId, //FK
        UUID senderId, //JWT subject
        String body, //message
        Instant sentAt,
        long seq // strict increasing integer stamp to have reliable order of messages
        ) {}
