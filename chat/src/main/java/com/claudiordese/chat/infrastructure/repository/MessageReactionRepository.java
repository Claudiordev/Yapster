package com.claudiordese.chat.infrastructure.repository;

import com.claudiordese.chat.infrastructure.entity.MessageReactionEntity;
import com.claudiordese.chat.infrastructure.entity.id.MessageReactionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MessageReactionRepository extends JpaRepository<MessageReactionEntity, MessageReactionId> {

    List<MessageReactionEntity> findByMessageIdInOrderByCreatedAtAsc(Collection<UUID> messageIds);

    /**
     * Idempotent insert: the (message, user, emoji) key already existing is not an error
     * @return 1 if the reaction was added, 0 if it was already there
     */
    @Modifying
    @Query(value = "INSERT INTO message_reaction (message_id, user_id, emoji, created_at) "
            + "VALUES (:messageId, :userId, :emoji, :createdAt) ON CONFLICT DO NOTHING", nativeQuery = true)
    int insertIfAbsent(@Param("messageId") UUID messageId, @Param("userId") UUID userId,
                       @Param("emoji") String emoji, @Param("createdAt") Instant createdAt);

    /**
     * @return 1 (rows removed) if the reaction was removed, 0 if there was none
     */
    @Modifying
    @Query("DELETE FROM MessageReactionEntity r WHERE r.messageId = :messageId AND r.userId = :userId AND r.emoji = :emoji")
    int remove(@Param("messageId") UUID messageId, @Param("userId") UUID userId, @Param("emoji") String emoji);
}
