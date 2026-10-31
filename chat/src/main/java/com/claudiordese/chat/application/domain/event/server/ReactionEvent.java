package com.claudiordese.chat.application.domain.event.server;

import com.claudiordese.chat.application.domain.event.types.EventType;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Value;

/**
 * A user added or removed a reaction. {@code emoji} is the unified hex key ("1f44d"), as stored.
 */
@Value
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public final class ReactionEvent implements ServerEvent {

    String roomId;
    String messageId;
    String userId;
    String emoji;

    @Getter(AccessLevel.NONE)
    EventType type;

    public static ReactionEvent added(String roomId, String messageId, String userId, String emoji) {
        return new ReactionEvent(roomId, messageId, userId, emoji, EventType.REACTION_ADDED);
    }

    public static ReactionEvent removed(String roomId, String messageId, String userId, String emoji) {
        return new ReactionEvent(roomId, messageId, userId, emoji, EventType.REACTION_REMOVED);
    }

    @Override
    @JsonProperty("type")
    public EventType type() {
        return type;
    }
}
