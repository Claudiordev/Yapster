package com.claudiordese.chat.application.port.persistence;

import com.claudiordese.chat.application.domain.chat.Conversation;
import com.claudiordese.chat.application.domain.chat.ConversationMember;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationStore {
    Conversation create(Conversation c);

    Optional<Conversation> findById(UUID id);

    /**
     * @param dmKey "userA:userB"
     * @return Conversation or null
     */
    Optional<Conversation> findByDmKey(String dmKey);

    /**
     * @return List of conversations
     */
    List<Conversation> findForUser(UUID userID);

    /**
     * @return List of uuid (JWT subject) members
     */
    List<UUID> membersOf(UUID conversationId);

    /**
     * @return true if belongs to conversation
     */
    boolean isMember(UUID conversationId, UUID userId);

    /**
     * Adds a member to a conversation
     * Inserts into conversation_member table in case of persistence
     * @return new ConversationMember created
     */
    ConversationMember addMember(UUID conversationId, UUID userId);

    /**
     * @return last read seq for user and conversation
     */
    long lastReadSeq(UUID conversationId, UUID userId);

    /**
     * Marks conversation read until seq
     */
    void markRead(UUID conversationId, UUID userId, long seq);

}
