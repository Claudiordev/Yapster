package com.claudiordese.comms.application.service;

import com.claudiordese.comms.application.domain.Conversation;
import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.port.MessageProviderGateway;
import com.claudiordese.comms.application.port.MessageStore;
import com.claudiordese.comms.application.service.commands.GetMessageCommand;
import com.claudiordese.comms.application.service.commands.SendMessageCommand;
import com.claudiordese.comms.application.service.result.MessageResult;
import com.twilio.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CommsService {

    private final MessageProviderGateway provider;
    private final MessageStore messages;
    private final MessageLogger messageLogger;
    private final Clock clock;

    public CommsService(MessageProviderGateway provider, MessageStore messages,
                        MessageLogger messageLogger,
                        Clock clock) {
        this.provider = provider;
        this.messages = messages;
        this.messageLogger = messageLogger;
        this.clock = clock;
    }

    public MessageResult send(SendMessageCommand cmd) {
        UUID id = UUID.randomUUID();
        Instant now = Instant.now(clock);

        try {
            MessageResult result = provider.send(cmd.receiver(), cmd.body());

            messageLogger.scheduleFetchAndRecord(id, cmd, result.providerId(), now);
            return result;
        } catch (RuntimeException e) {
            messageLogger.recordFailed(id, cmd, e.getMessage(), now);
            throw e;
        }
    }

    /**
     * All conversations the given sender has, grouped by recipient. Within a
     * conversation, messages are oldest-first. Recipients are ordered by the
     * sender's first message to them.
     */
    public List<Conversation> conversationsFor(String sender) {
        Map<String, List<Message>> grouped = messages.findAllBySender(sender).stream()
                .collect(Collectors.groupingBy(
                        Message::receiver,
                        LinkedHashMap::new,
                        Collectors.toList()));

        return grouped.entrySet().stream()
                .map(e -> new Conversation(e.getKey(), e.getValue()))
                .toList();
    }

    public MessageResult getMessage(GetMessageCommand getMessageCommand) {
        return provider.fetch(getMessageCommand.id());
    }
}
