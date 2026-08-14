package com.claudiordese.chat.application.domain.chat;

import com.claudiordese.chat.application.domain.chat.types.UserStatusType;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ConversationSummary(
        Conversation conversation,
        List<UUID> recipientsIds,
        Map<UUID, UserStatusType> recipientsStatus,
        Message message,
        long lastReadSeq,
        long unreadCount) {
}
