package com.claudiordese.chat.application.port.persistence;

import com.claudiordese.chat.application.domain.chat.Message;
import com.claudiordese.chat.application.domain.chat.Reaction;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageStore {

    Message saveMessage(Message message);

    /**
     * @param messageId UUID id
     * @return Message or empty
     */
    Optional<Message> findById(UUID messageId);

    /**
     * Paginated history of conversation
     * @param conversationId UUID id
     * @param beforeSeq give me messages older than this sequence
     * @param limit number of elements per page
     * @return List of Messages
     */
    List<Message> history(UUID conversationId, long beforeSeq, int limit);

    /**
     * Preview message, latest or null
     * @param conversationId UUID id
     * @return Message or null
     */
    Optional<Message> latest(UUID conversationId);

    /**
     * Latest non-system message (conversation list preview)
     * @param conversationId UUID id
     * @return Message or empty
     */
    Optional<Message> latestUserMessage(UUID conversationId);

    /**
     * Get count of user messages since sequence (system messages never count as unread)
     * @param conversationId UUID id
     * @param lastReadSeq long seq
     * @return long count, used for unread count
     */
    long countSince(UUID conversationId, long lastReadSeq);

    /**
     * Idempotent: reacting twice with the same emoji keeps a single reaction
     * @param reaction message, user and emoji
     * @return true if it was added, false if the user had already reacted with it
     */
    boolean addReaction(Reaction reaction);

    /**
     * @return true if the reaction was removed, false if there was none
     */
    boolean removeReaction(UUID messageId, UUID userId, String emoji);

    /**
     * Reactions of a page of messages in one query, oldest first
     * @param messageIds messages to load reactions for
     * @return List of Reactions
     */
    List<Reaction> findReactionsByMessageIds(Collection<UUID> messageIds);
}
