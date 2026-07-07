package com.claudiordese.chat.infrastructure.adapter.persistence.mapper;

import com.claudiordese.chat.application.domain.chat.Conversation;
import com.claudiordese.chat.application.domain.chat.ConversationMember;
import com.claudiordese.chat.infrastructure.entity.ConversationEntity;
import com.claudiordese.chat.infrastructure.entity.ConversationMemberEntity;
import org.springframework.stereotype.Component;

/**
 * Translates between the persistence entities (ConversationEntity,
 * ConversationMemberEntity) and their pure domain records. Lives in
 * infrastructure — the domain never sees an entity.
 */
@Component
public class ConversationMapper {

    // --- Conversation ---

    public Conversation toDomain(ConversationEntity e) {
        return new Conversation(
                e.getId(),
                e.getType(),
                e.getName(),
                e.getDmKey(),
                e.getCreatedAt());
    }

    public ConversationEntity toEntity(Conversation c) {
        ConversationEntity e = new ConversationEntity();
        e.setId(c.id());
        e.setType(c.type());
        e.setName(c.name());
        e.setDmKey(c.dmKey());
        e.setCreatedAt(c.createdAt());
        return e;
    }

    // --- ConversationMember ---

    public ConversationMember toDomain(ConversationMemberEntity e) {
        return new ConversationMember(e.getConversationId(), e.getUserId(), e.getLastReadSeq());
    }

    public ConversationMemberEntity toEntity(ConversationMember m) {
        ConversationMemberEntity e = new ConversationMemberEntity();
        e.setConversationId(m.conversationId());
        e.setUserId(m.userId());
        e.setLastReadSeq(m.lastReadSeq());
        return e;
    }
}
