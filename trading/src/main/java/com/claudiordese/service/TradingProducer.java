package com.claudiordese.service;

import com.claudiordese.dto.HitEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@org.springframework.boot.autoconfigure.condition.ConditionalOnBean(org.springframework.kafka.core.KafkaTemplate.class)
public class TradingProducer {

    private static final Logger logger = LoggerFactory.getLogger(TradingProducer.class);
    @Value("${trading.kafka.sending.data}")
    private boolean sendingData;
    @Value("${trading.kafka.topic}")
    private String topic;

    private final KafkaTemplate<String, HitEvent> kafkaTemplate;

    public TradingProducer(@org.springframework.beans.factory.annotation.Qualifier("hitKafkaTemplate") KafkaTemplate<String, HitEvent> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void send(HitEvent hitEvent) {
        if (sendingData) {
            kafkaTemplate.send(topic, String.valueOf(hitEvent.blockId()), hitEvent).whenComplete((result, error) -> {
                if (error != null) {
                    logger.error("Error sending hit to topic {}: {}", topic, error.getMessage());
                } else {
                    logger.info("Sent hit to topic {} offset {}, partition {}",
                            topic, result.getRecordMetadata().offset(), result.getRecordMetadata().partition());
                }
            });
        }
    }
}
