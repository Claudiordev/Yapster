package com.claudiordese.chat.application.domain.chat;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * One emoji on a message and everyone who reacted with it, in the order they reacted.
 */
public record ReactionSummary(String emoji, List<UUID> userIds) {

    /**
     * Groups reactions per message, then per emoji. Emoji (and the users inside each) keep the order of
     * the input, so passing reactions oldest first gives the pill order.
     */
    public static Map<UUID, List<ReactionSummary>> byMessage(Collection<Reaction> reactions) {
        Map<UUID, Map<String, List<UUID>>> grouped = new HashMap<>();

        for (Reaction reaction : reactions) {
            grouped.computeIfAbsent(reaction.messageId(), id -> new LinkedHashMap<>())
                    .computeIfAbsent(reaction.emoji(), emoji -> new ArrayList<>())
                    .add(reaction.userId());
        }

        Map<UUID, List<ReactionSummary>> result = new HashMap<>();

        grouped.forEach((messageId, byEmoji) -> result.put(messageId, byEmoji.entrySet().stream()
                .map(entry -> new ReactionSummary(entry.getKey(), entry.getValue()))
                .toList()));

        return result;
    }
}
