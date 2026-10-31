package com.claudiordese.chat.infrastructure.controller.responses;

import com.claudiordese.chat.application.domain.chat.ReactionSummary;

import java.util.List;
import java.util.UUID;

/**
 * @param emoji unified hex key, e.g. "1f44d"
 */
public record ReactionResponse(String emoji, int count, List<UUID> userIds) {

    public static ReactionResponse of(ReactionSummary summary) {
        return new ReactionResponse(summary.emoji(), summary.userIds().size(), summary.userIds());
    }
}
