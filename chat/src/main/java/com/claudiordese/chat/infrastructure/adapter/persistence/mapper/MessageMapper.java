package com.claudiordese.chat.infrastructure.adapter.persistence.mapper;

import com.claudiordese.chat.application.domain.chat.Message;
import com.claudiordese.chat.application.domain.chat.Reaction;
import com.claudiordese.chat.infrastructure.entity.MessageEntity;
import com.claudiordese.chat.infrastructure.entity.MessageReactionEntity;
import org.springframework.stereotype.Component;

/**
 * Translates between the persistence entity (MessageEntity) and the pure domain
 * record (Message). Lives in infrastructure — the domain never sees the entity.
 */
@Component
public class MessageMapper {

    public Message toDomain(MessageEntity e) {
        return new Message(
                e.getId(),
                e.getConversationId(),
                e.getSenderId(),
                e.getBody(),
                e.getSentAt(),
                e.getSeq(),
                e.getType(),
                e.getSystemEvent(),
                e.getSubjectId());
    }

    public Reaction toDomain(MessageReactionEntity e) {
        return new Reaction(e.getMessageId(), e.getUserId(), e.getEmoji(), e.getCreatedAt());
    }

    public MessageEntity toEntity(Message m) {
        MessageEntity e = new MessageEntity();
        e.setId(m.id());
        e.setConversationId(m.conversationId());
        e.setSenderId(m.senderId());
        e.setBody(m.body());
        e.setSentAt(m.sentAt());
        e.setType(m.type());
        e.setSystemEvent(m.systemEvent());
        e.setSubjectId(m.subjectId());
        // seq is DB-generated (@Generated(INSERT), insertable=false) — never set on write
        return e;
    }
}
