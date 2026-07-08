package com.claudiordese.chat.infrastructure.adapter.persistence;

import com.claudiordese.chat.application.domain.chat.Conversation;
import com.claudiordese.chat.application.domain.chat.ConversationMember;
import com.claudiordese.chat.application.port.persistence.ConversationStore;
import com.claudiordese.chat.infrastructure.adapter.persistence.mapper.ConversationMapper;
import com.claudiordese.chat.infrastructure.entity.ConversationMemberEntity;
import com.claudiordese.chat.infrastructure.repository.ConversationMemberRepository;
import com.claudiordese.chat.infrastructure.repository.ConversationRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@AllArgsConstructor
public class JpaConversationStore implements ConversationStore {

    private final ConversationRepository conversations;
    private final ConversationMemberRepository members;
    private final ConversationMapper mapper;

    @Override
    public Conversation create(Conversation c) {
        return mapper.toDomain(conversations.save(mapper.toEntity(c)));
    }

    @Override
    public Optional<Conversation> findById(UUID id) {
        return conversations.findById(id).map(mapper::toDomain);
    }

    @Override
    public Optional<Conversation> findByDmKey(String dmKey) {
        return conversations.findByDmKey(dmKey).map(mapper::toDomain);
    }

    @Override
    public List<Conversation> findForUser(UUID userID) {
        List<UUID> ids = members.findByUserId(userID).stream()
                .map(ConversationMemberEntity::getConversationId).toList();
        return conversations.findAllById(ids).stream().map(mapper::toDomain).toList();
    }

    @Override
    public List<UUID> membersOf(UUID conversationId) {
        return members.findByConversationId(conversationId).stream()
                .map(ConversationMemberEntity::getUserId).toList();
    }

    @Override
    public boolean isMember(UUID conversationId, UUID userId) {
        return members.existsByConversationIdAndUserId(conversationId, userId);
    }

    @Override
    public ConversationMember addMember(UUID conversationId, UUID userId) {
        return members.findByConversationIdAndUserId(conversationId, userId)
                .map(mapper::toDomain)   // already a member → return existing
                .orElseGet(() -> mapper.toDomain(
                        members.save(mapper.toEntity(new ConversationMember(conversationId, userId, 0)))));
    }

    @Override
    public long lastReadSeq(UUID conversationId, UUID userId) {
        return members.findByConversationIdAndUserId(conversationId, userId)
                .map(ConversationMemberEntity::getLastReadSeq).orElse(0L);
    }

    @Override
    public void markRead(UUID conversationId, UUID userId, long seq) {
        members.findByConversationIdAndUserId(conversationId, userId).ifPresent(e -> {
            if (seq > e.getLastReadSeq()) {
                e.setLastReadSeq(seq);
                members.save(e);
            }
        });
    }
}
