package com.claudiordese.comms.application.port;

import com.claudiordese.comms.application.domain.Message;

import java.util.Optional;
import java.util.UUID;

public interface MessageStore {
    Message save(Message message);
    Optional<Message> findById(UUID id);
}
