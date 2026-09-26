package com.claudiordese.chat.infrastructure.repository;

import com.claudiordese.chat.application.domain.chat.types.MessageType;
import com.claudiordese.chat.infrastructure.entity.MessageEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<MessageEntity, UUID> {

    /**
     * Find by conversation ID and seq less than order desc paginated
     */
    List<MessageEntity> findByConversationIdAndSeqLessThanOrderBySeqDesc(UUID conversationId, long seqIsLessThan, Pageable pageable);

    /**
     * Find by conversation ID, order by seq desc
     */
    Optional<MessageEntity> findFirstByConversationIdOrderBySeqDesc(UUID id);

    /**
     * Latest message of a given type (previews skip SYSTEM messages)
     */
    Optional<MessageEntity> findFirstByConversationIdAndTypeOrderBySeqDesc(UUID id, MessageType type);

    /**
     * Count unread by conversation ID and seq
     */
    long countByConversationIdAndTypeAndSeqGreaterThan(UUID conversationId, MessageType type, long lastReadSeq);
}
