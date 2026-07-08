package com.claudiordese.chat.application.domain.chat;

import java.util.List;
import java.util.UUID;

public record ConversationSummary(
        Conversation conversation,
        List<UUID> recipientsIds,
        Message message,
        long lastReadSeq,
        long unreadCount) {
}
