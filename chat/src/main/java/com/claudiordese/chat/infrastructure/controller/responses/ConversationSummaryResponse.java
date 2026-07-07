package com.claudiordese.chat.infrastructure.controller.responses;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ConversationSummaryResponse(UUID id, String type, String name, List<UUID> memberIds, String lastMessage, Instant lastMessageAt, Long lastMessageSeq, long lastReadSeq, long unreadCount) {
}
