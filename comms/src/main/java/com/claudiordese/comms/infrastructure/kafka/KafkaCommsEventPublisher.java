package com.claudiordese.comms.infrastructure.kafka;

import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.port.CommsEventPublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@ConditionalOnProperty(name = "spring.kafka.bootstrap-servers")
public class KafkaCommsEventPublisher implements CommsEventPublisher {

    private static final Logger logger = LoggerFactory.getLogger(KafkaCommsEventPublisher.class);

    private final KafkaTemplate<String, MessageEvent> messageKafkaTemplate;
    private final KafkaTemplate<String, LogEvent> logKafkaTemplate;

    @Value("${comms.kafka.topics.messages:comms-messages}")
    private String messagesTopic;

    @Value("${comms.kafka.topics.logs:comms-logs}")
    private String logsTopic;

    public KafkaCommsEventPublisher(
            @Qualifier("messageKafkaTemplate") KafkaTemplate<String, MessageEvent> messageKafkaTemplate,
            @Qualifier("logKafkaTemplate") KafkaTemplate<String, LogEvent> logKafkaTemplate) {
        this.messageKafkaTemplate = messageKafkaTemplate;
        this.logKafkaTemplate = logKafkaTemplate;
    }

    @Override
    public void queued(Message message) {
        publishLog(LogEvent.info("MESSAGE_QUEUED", message.sender(), message.id().toString(),
                "Queued message to " + message.receiver()));
    }

    @Override
    public void sent(Message message) {
        publishMessage(new MessageEvent(
                message.id().toString(),
                message.sender(),
                message.receiver(),
                message.status().name(),
                message.providerId().orElse(null),
                Instant.now()));
        publishLog(LogEvent.info("MESSAGE_SENT", message.sender(), message.id().toString(),
                "Provider id " + message.providerId().orElse("")));
    }

    @Override
    public void failed(Message message, String reason) {
        publishLog(LogEvent.error("MESSAGE_FAILED", message.sender(), message.id().toString(), reason));
    }

    private void publishMessage(MessageEvent event) {
        messageKafkaTemplate.send(messagesTopic, event.messageId(), event).whenComplete((result, error) -> {
            if (error != null) {
                logger.error("Failed to publish message event {} to {}: {}",
                        event.messageId(), messagesTopic, error.getMessage());
            } else {
                logger.debug("Published message event {} to {} (offset={}, partition={})",
                        event.messageId(), messagesTopic,
                        result.getRecordMetadata().offset(), result.getRecordMetadata().partition());
            }
        });
    }

    private void publishLog(LogEvent event) {
        logKafkaTemplate.send(logsTopic, event.messageId(), event).whenComplete((result, error) -> {
            if (error != null) {
                logger.error("Failed to publish log event for {} to {}: {}",
                        event.messageId(), logsTopic, error.getMessage());
            }
        });
    }
}
