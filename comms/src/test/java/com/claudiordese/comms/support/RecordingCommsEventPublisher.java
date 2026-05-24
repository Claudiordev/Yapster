package com.claudiordese.comms.support;

import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.domain.MessageStatus;
import com.claudiordese.comms.application.port.CommsEventPublisher;

import java.util.ArrayList;
import java.util.List;

public class RecordingCommsEventPublisher implements CommsEventPublisher {

    public record Event(MessageStatus status, String messageId, String reason) {}

    private final List<Event> events = new ArrayList<>();

    @Override
    public void queued(Message message) {
        events.add(new Event(MessageStatus.QUEUED, message.id().toString(), null));
    }

    @Override
    public void sent(Message message) {
        events.add(new Event(MessageStatus.SENT, message.id().toString(), null));
    }

    @Override
    public void failed(Message message, String reason) {
        events.add(new Event(MessageStatus.FAILED, message.id().toString(), reason));
    }

    public List<Event> events() {
        return events;
    }
}
