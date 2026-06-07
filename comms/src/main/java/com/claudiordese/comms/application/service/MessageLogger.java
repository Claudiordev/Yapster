package com.claudiordese.comms.application.service;

import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.port.MessageProviderGateway;
import com.claudiordese.comms.application.port.MessageStore;
import com.claudiordese.comms.application.service.commands.SendMessageCommand;
import com.claudiordese.comms.application.service.result.MessageResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;


@Component
public class MessageLogger {

    private static final Logger log = LoggerFactory.getLogger(MessageLogger.class);

    private final MessageStore messages;
    private final MessageProviderGateway provider;
    private final TaskScheduler scheduler;
    private final Duration fetchDelay;

    public MessageLogger(MessageStore messages,
                         MessageProviderGateway provider,
                         TaskScheduler messageFetchScheduler,
                         @Value("${comms.audit.fetch-delay:PT3S}") Duration fetchDelay) {
        this.messages = messages;
        this.provider = provider;
        this.scheduler = messageFetchScheduler;
        this.fetchDelay = fetchDelay;
    }

    @Async("messageLogExecutor")
    public void recordFailed(UUID id, SendMessageCommand cmd, String errorMessage, Instant createdAt) {
        save(new Message(id, cmd, errorMessage, createdAt));
    }

    /**
     * Success path — schedule a delayed re-fetch from the provider so we record
     * the eventual status rather than the moment-of-acceptance "queued".
     */
    public void scheduleFetchAndRecord(UUID id, SendMessageCommand cmd, String providerId, Instant createdAt) {
        scheduler.schedule(() -> fetchAndSave(id, cmd, providerId, createdAt), Instant.now().plus(fetchDelay));
    }

    /** Package-private so tests can drive it without the scheduler indirection. */
    void fetchAndSave(UUID id, SendMessageCommand cmd,
                      String providerId, Instant createdAt) {
        try {
            MessageResult latest = provider.fetch(providerId);
            save(new Message(id, cmd, latest, createdAt));
        } catch (Exception e) {
            log.error("Failed to fetch+save message {} (providerId={})", id, providerId, e);
        }
    }

    private void save(Message message) {
        try {
            messages.save(message);
        } catch (Exception e) {
            log.error("Failed to persist message log {}", message.id(), e);
        }
    }
}
