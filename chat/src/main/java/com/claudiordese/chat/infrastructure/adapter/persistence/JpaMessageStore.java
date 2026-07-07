package com.claudiordese.chat.infrastructure.adapter.persistence;

import com.claudiordese.chat.application.domain.chat.Message;
import com.claudiordese.chat.application.port.persistence.MessageStore;
import com.claudiordese.chat.infrastructure.entity.MessageEntity;
import com.claudiordese.chat.infrastructure.repository.MessageRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class JpaMessageStore implements MessageStore {

    private final MessageRepository repo;

    public JpaMessageStore(MessageRepository repo) {
        this.repo = repo;
    }

    @Override
    public Message saveMessage(Message message) {
        MessageEntity messageEntity = new MessageEntity();
        messageEntity.setId(message.id());
        messageEntity.setConversationId(message.conversationId());
        messageEntity.setSenderId(message.senderId());
        messageEntity.setBody(message.body());
        messageEntity.setSentAt(message.sentAt());

        MessageEntity saved = repo.saveAndFlush(messageEntity);

        return toDomain(saved);
    }

    @Override
    public List<Message> history(UUID conversationId, long beforeSeq, int limit) {
        return repo.findByConversationIdAndSeqLessThanOrderBySeqDesc(
                conversationId,
                beforeSeq,
                PageRequest.of(0, limit)).stream().map(this::toDomain).toList();
    }

    @Override
    public Optional<Message> latest(UUID conversationId) {
        return repo.findFirstByConversationIdOrderBySeqDesc(conversationId).map(this::toDomain);
    }

    @Override
    public long countSince(UUID conversationId, long lastReadSeq) {
        return repo.countByConversationIdAndSeqGreaterThan(conversationId,lastReadSeq);
    }

    public Message toDomain(MessageEntity e) {
        return new Message(
                e.getId(),
                e.getConversationId(),
                e.getSenderId(),
                e.getBody(),
                e.getSentAt(),
                e.getSeq());
    }
}
