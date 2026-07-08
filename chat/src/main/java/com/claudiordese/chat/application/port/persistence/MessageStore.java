package com.claudiordese.chat.application.port.persistence;

import com.claudiordese.chat.application.domain.chat.Message;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageStore {

    Message saveMessage(Message message);

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
     * Get count of messages since sequence
     * @param conversationId UUID id
     * @param lastReadSeq long seq
     * @return long count, used for unread count
     */
    long countSince(UUID conversationId, long lastReadSeq);
}
