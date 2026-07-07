package com.claudiordese.chat.application.domain.chat;

import com.claudiordese.chat.application.domain.chat.types.ConversationType;

import java.time.Instant;
import java.util.UUID;

public record Conversation(
        UUID id,
        ConversationType type,
        String name, //group name, null for DMs
        String dmKey, //"userA:user:B"
        Instant createdAt
) {}
