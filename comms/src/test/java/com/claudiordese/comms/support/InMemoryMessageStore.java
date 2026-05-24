package com.claudiordese.comms.support;

import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.port.MessageStore;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public class InMemoryMessageStore implements MessageStore {

    private final List<Message> messages = new ArrayList<>();

    @Override
    public void save(Message message) {
        messages.add(message);
    }

    @Override
    public List<Message> findAllBySender(String sender) {
        return messages.stream()
                .filter(m -> m.sender().equals(sender))
                .sorted(Comparator.comparing(Message::createdAt))
                .toList();
    }

    public List<Message> all() {
        return List.copyOf(messages);
    }

    public Message byId(UUID id) {
        return messages.stream()
                .filter(m -> m.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No message with id " + id));
    }
}
