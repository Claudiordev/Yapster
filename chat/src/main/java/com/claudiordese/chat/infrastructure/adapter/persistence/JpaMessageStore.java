package com.claudiordese.chat.infrastructure.adapter.persistence;

import com.claudiordese.chat.application.domain.chat.Message;
import com.claudiordese.chat.application.domain.chat.Reaction;
import com.claudiordese.chat.application.domain.chat.types.MessageType;
import com.claudiordese.chat.application.port.persistence.MessageStore;
import com.claudiordese.chat.infrastructure.adapter.persistence.mapper.MessageMapper;
import com.claudiordese.chat.infrastructure.repository.MessageReactionRepository;
import com.claudiordese.chat.infrastructure.repository.MessageRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class JpaMessageStore implements MessageStore {

    private final MessageRepository repo;
    private final MessageReactionRepository reactionRepo;
    private final MessageMapper mapper;

    public JpaMessageStore(MessageRepository repo, MessageReactionRepository reactionRepo, MessageMapper mapper) {
        this.repo = repo;
        this.reactionRepo = reactionRepo;
        this.mapper = mapper;
    }

    @Override
    public Message saveMessage(Message message) {
        return mapper.toDomain(repo.saveAndFlush(mapper.toEntity(message)));
    }

    @Override
    public Optional<Message> findById(UUID messageId) {
        return repo.findById(messageId).map(mapper::toDomain);
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
    public Optional<Message> latestUserMessage(UUID conversationId) {
        return repo.findFirstByConversationIdAndTypeOrderBySeqDesc(conversationId, MessageType.USER).map(mapper::toDomain);
    }

    @Override
    public long countSince(UUID conversationId, long lastReadSeq) {
        return repo.countByConversationIdAndTypeAndSeqGreaterThan(conversationId, MessageType.USER, lastReadSeq);
    }

    @Override
    public boolean addReaction(Reaction reaction) {
        return reactionRepo.insertIfAbsent(
                reaction.messageId(), reaction.userId(), reaction.emoji(), reaction.createdAt()) > 0;
    }

    @Override
    public boolean removeReaction(UUID messageId, UUID userId, String emoji) {
        return reactionRepo.remove(messageId, userId, emoji) > 0;
    }

    @Override
    public List<Reaction> findReactionsByMessageIds(Collection<UUID> messageIds) {
        if (messageIds.isEmpty()) return List.of();

        return reactionRepo.findByMessageIdInOrderByCreatedAtAsc(messageIds)
                .stream().map(mapper::toDomain).toList();
    }
}
