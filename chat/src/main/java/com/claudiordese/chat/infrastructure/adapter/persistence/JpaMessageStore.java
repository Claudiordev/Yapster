package com.claudiordese.chat.infrastructure.adapter.persistence;

import com.claudiordese.chat.application.domain.chat.Message;
import com.claudiordese.chat.application.port.persistence.MessageStore;
import com.claudiordese.chat.infrastructure.adapter.persistence.mapper.MessageMapper;
import com.claudiordese.chat.infrastructure.repository.MessageRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class JpaMessageStore implements MessageStore {

    private final MessageRepository repo;
    private final MessageMapper mapper;

    public JpaMessageStore(MessageRepository repo, MessageMapper mapper) {
        this.repo = repo;
        this.mapper = mapper;
    }

    @Override
    public Message saveMessage(Message message) {
        return mapper.toDomain(repo.saveAndFlush(mapper.toEntity(message)));
    }

    @Override
    public List<Message> history(UUID conversationId, long beforeSeq, int limit) {
        return repo.findByConversationIdAndSeqLessThanOrderBySeqDesc(
                        conversationId, beforeSeq, PageRequest.of(0, limit))
                .stream().map(mapper::toDomain).toList();
    }

    @Override
    public Optional<Message> latest(UUID conversationId) {
        return repo.findFirstByConversationIdOrderBySeqDesc(conversationId).map(mapper::toDomain);
    }

    @Override
    public long countSince(UUID conversationId, long lastReadSeq) {
        return repo.countByConversationIdAndSeqGreaterThan(conversationId, lastReadSeq);
    }
}
