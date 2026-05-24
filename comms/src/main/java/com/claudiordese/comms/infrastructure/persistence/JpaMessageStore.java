package com.claudiordese.comms.infrastructure.persistence;

import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.port.MessageStore;
import com.claudiordese.comms.infrastructure.entity.MessageEntity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Component
public class JpaMessageStore implements MessageStore {

    private final SpringDataMessageRepository repository;

    JpaMessageStore(SpringDataMessageRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public Message save(Message message) {
        MessageEntity entity = repository.findById(message.id())
                .orElseGet(MessageEntity::new);
        applyTo(entity, message);
        return toDomain(repository.save(entity));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Message> findById(UUID id) {
        return repository.findById(id).map(JpaMessageStore::toDomain);
    }

    private static void applyTo(MessageEntity entity, Message message) {
        entity.setId(message.id());
        entity.setSender(message.sender());
        entity.setReceiver(message.receiver());
        entity.setBody(message.body());
        entity.setStatus(message.status());
        entity.setProviderId(message.providerId().orElse(null));
        entity.setPrice(message.price().orElse(null));
        entity.setPriceUnit(message.priceUnit().orElse(null));
        entity.setErrorMessage(message.errorMessage().orElse(null));
        entity.setCreatedAt(message.createdAt());
        entity.setUpdatedAt(message.updatedAt());
    }

    private static Message toDomain(MessageEntity entity) {
        return new Message(
                entity.getId(),
                entity.getSender(),
                entity.getReceiver(),
                entity.getBody(),
                entity.getStatus(),
                Optional.ofNullable(entity.getProviderId()),
                Optional.ofNullable(entity.getPrice()),
                Optional.ofNullable(entity.getPriceUnit()),
                Optional.ofNullable(entity.getErrorMessage()),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }
}
