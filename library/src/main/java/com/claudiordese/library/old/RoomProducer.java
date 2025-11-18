package com.claudiordese.library.old;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Service;

@Service
public class RoomProducer {
    private static final Logger logger = LoggerFactory.getLogger(RoomProducer.class);

    @Value("${app.kafka.topics.events.rooms}")
    private String TOPIC;
    private final KafkaTemplate<String, RoomEvent> kafkaTemplate;

    public RoomProducer(KafkaTemplate<String, RoomEvent> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendMessage(RoomEvent event) {
        logger.info("Adding event to: {} message: {}", TOPIC, event);

        Message<RoomEvent> message = MessageBuilder.withPayload(event).setHeader(KafkaHeaders.TOPIC, TOPIC).build();

        kafkaTemplate.send(message);
    }
}
