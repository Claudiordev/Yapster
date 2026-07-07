package com.claudiordese.chat.infrastructure.adapter.persistence;

import com.claudiordese.chat.application.domain.chat.Conversation;
import com.claudiordese.chat.application.domain.chat.ConversationMember;
import com.claudiordese.chat.application.port.persistence.ConversationStore;
import com.claudiordese.chat.infrastructure.entity.ConversationEntity;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class JpaConversationStore implements ConversationStore {


    @Override
    public Conversation create(Conversation c) {
        ConversationEntity conversationEntity = new ConversationEntity();
        conversationEntity.setId(c.id());
        conversationEntity.setType(c.type());
        conversationEntity.setName(c.name());
        conversationEntity.setDmKey(c.dmKey());
        conversationEntity.setCreatedAt(c.createdAt());

        return toDomain(conversationEntity);
    }

    @Override
    public Optional<Conversation> findById(UUID id) {
        return Optional.empty();
    }

    @Override
    public Optional<Conversation> findByDmKey(String dmKey) {
        return Optional.empty();
    }

    @Override
    public List<Conversation> findForUser(UUID userID) {
        return List.of();
    }

    @Override
    public List<UUID> membersOf(UUID conversationId) {
        return List.of();
    }

    @Override
    public boolean isMember(UUID conversationId, UUID userId) {
        return false;
    }

    @Override
    public ConversationMember addMember(UUID conversationId, UUID userId) {
        return null;
    }

    @Override
    public long lastReadSeq(UUID conversationId, UUID userId) {
        return 0;
    }

    @Override
    public void markRead(UUID conversationId, UUID userId, long seq) {

    }

    public Conversation toDomain(ConversationEntity c) {
        return new Conversation(
                c.getId(),
                c.getType(),
                c.getName(),
                c.getDmKey(),
                c.getCreatedAt());
    }
}
