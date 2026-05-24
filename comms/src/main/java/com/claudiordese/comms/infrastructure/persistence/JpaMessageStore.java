package com.claudiordese.comms.infrastructure.persistence;

import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.port.MessageStore;
import com.claudiordese.comms.infrastructure.entity.MessageEntity;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class JpaMessageStore implements MessageStore {

    private final SpringDataMessageRepository repository;

    JpaMessageStore(SpringDataMessageRepository repository) {
        this.repository = repository;
    }

    @Override
    public void save(Message message) {
        repository.save(toEntity(message));
    }

    @Override
    public List<Message> findAllBySender(String sender) {
        return repository.findBySenderOrderByCreatedAtAsc(sender).stream()
                .map(JpaMessageStore::toDomain)
                .toList();
    }

    private static MessageEntity toEntity(Message m) {
        MessageEntity e = new MessageEntity();

        e.setId(m.id());
        e.setSender(m.sender());
        e.setReceiver(m.receiver());
        e.setBody(m.body());
        e.setStatus(m.status());
        e.setProviderId(m.providerId().orElse(null));
        e.setPrice(m.price().orElse(null));
        e.setPriceUnit(m.priceUnit().orElse(null));
        e.setErrorMessage(m.errorMessage().orElse(null));
        e.setCreatedAt(m.createdAt());

        return e;
    }

    private static Message toDomain(MessageEntity e) {
        return new Message(
                e.getId(),
                e.getSender(),
                e.getReceiver(),
                e.getBody(),
                e.getStatus(),
                Optional.ofNullable(e.getProviderId()),
                Optional.ofNullable(e.getPrice()),
                Optional.ofNullable(e.getPriceUnit()),
                Optional.ofNullable(e.getErrorMessage()),
                e.getCreatedAt());
    }
}
