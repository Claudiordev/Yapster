package com.claudiordese.comms.application.port;

import com.claudiordese.comms.application.domain.Message;

public interface CommsEventPublisher {
    void queued(Message message);
    void sent(Message message);
    void failed(Message message, String reason);
}
