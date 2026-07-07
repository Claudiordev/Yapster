package com.claudiordese.chat.infrastructure.repository;

import com.claudiordese.chat.infrastructure.entity.ConversationMemberEntity;
import com.claudiordese.chat.infrastructure.entity.id.ConversationMemberId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationMemberRepository extends JpaRepository<ConversationMemberEntity, ConversationMemberId> {
    List<ConversationMemberEntity> findByConversationId(UUID conversationId);
    List<ConversationMemberEntity> findByUserId(UUID userId);
    boolean existsByConversationIdAndUserId(UUID conversationId, UUID userId);
    Optional<ConversationMemberEntity> findByConversationIdAndUserId(UUID conversationId, UUID userId);
}
