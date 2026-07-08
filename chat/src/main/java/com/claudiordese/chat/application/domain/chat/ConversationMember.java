package com.claudiordese.chat.application.domain.chat;

import java.util.UUID;

public record ConversationMember(
        UUID conversationId,
        UUID userId,
        long lastReadSeq) {}
