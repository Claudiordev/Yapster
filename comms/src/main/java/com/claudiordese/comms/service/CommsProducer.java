package com.claudiordese.comms.service;

import com.claudiordese.comms.dto.LogEvent;
import com.claudiordese.comms.dto.MessageEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "spring.kafka.bootstrap-servers")
public class CommsProducer {

    private static final Logger logger = LoggerFactory.getLogger(CommsProducer.class);

    private final KafkaTemplate<String, MessageEvent> messageKafkaTemplate;
    private final KafkaTemplate<String, LogEvent> logKafkaTemplate;

    @Value("${comms.kafka.topics.messages:comms-messages}")
    private String messagesTopic;

    @Value("${comms.kafka.topics.logs:comms-logs}")
    private String logsTopic;

    public CommsProducer(
            @Qualifier("messageKafkaTemplate") KafkaTemplate<String, MessageEvent> messageKafkaTemplate,
            @Qualifier("logKafkaTemplate") KafkaTemplate<String, LogEvent> logKafkaTemplate) {
        this.messageKafkaTemplate = messageKafkaTemplate;
        this.logKafkaTemplate = logKafkaTemplate;
    }

    public void publishMessage(MessageEvent event) {
        messageKafkaTemplate.send(messagesTopic, event.messageId(), event).whenComplete((result, error) -> {
            if (error != null) {
                logger.error("Failed to publish message event {} to {}: {}", event.messageId(), messagesTopic, error.getMessage());
            } else {
                logger.debug("Published message event {} to {} (offset={}, partition={})",
                        event.messageId(), messagesTopic,
                        result.getRecordMetadata().offset(), result.getRecordMetadata().partition());
            }
        });
    }

    public void publishLog(LogEvent event) {
        logKafkaTemplate.send(logsTopic, event.messageId(), event).whenComplete((result, error) -> {
            if (error != null) {
                logger.error("Failed to publish log event for {} to {}: {}", event.messageId(), logsTopic, error.getMessage());
            }
        });
    }
}
