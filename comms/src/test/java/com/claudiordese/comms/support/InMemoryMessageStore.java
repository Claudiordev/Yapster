package com.claudiordese.comms.support;

import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.port.MessageStore;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public class InMemoryMessageStore implements MessageStore {

    private final Map<UUID, Message> messages = new HashMap<>();
    private int saveCalls;

    @Override
    public Message save(Message message) {
        saveCalls++;
        messages.put(message.id(), message);
        return message;
    }

    @Override
    public Optional<Message> findById(UUID id) {
        return Optional.ofNullable(messages.get(id));
    }

    public int saveCalls() {
        return saveCalls;
    }
}
