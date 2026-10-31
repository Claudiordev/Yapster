package com.claudiordese.library.messages.producer;

import com.claudiordese.library.model.domain.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class MessagesProducer {
    private final Logger logger = LoggerFactory.getLogger(MessagesProducer.class);

    @Value ("${app.kafka.topics.events.messages}")
    private String TOPIC = "global-events";
    private final KafkaTemplate<String, Message> kafkaTemplate;

    public MessagesProducer(KafkaTemplate<String, Message> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendDataAsync(Message message) {
        kafkaTemplate.send(TOPIC, message).whenComplete((result, error) -> {
           logger.info("Sending message to Topic {} offset {}, partition {}", TOPIC, result.getRecordMetadata().offset(), result.getRecordMetadata().partition());
           if (error != null) {
               logger.error("Error sending message to topic {}, error {}", TOPIC, error.getMessage());
           }
        });
    }
}
