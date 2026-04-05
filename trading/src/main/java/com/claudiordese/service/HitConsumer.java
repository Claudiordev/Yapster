package com.claudiordese.service;

import com.claudiordese.dto.HitEvent;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
@org.springframework.boot.autoconfigure.condition.ConditionalOnBean(org.springframework.kafka.core.ConsumerFactory.class)
public class HitConsumer {

    private static final Logger logger = LoggerFactory.getLogger(HitConsumer.class);

    private final List<HitEvent> hits = new CopyOnWriteArrayList<>();
    private final ConsumerFactory<String, HitEvent> consumerFactory;
    private final String topic;

    public HitConsumer(ConsumerFactory<String, HitEvent> consumerFactory,
                       @org.springframework.beans.factory.annotation.Value("${trading.kafka.topic}") String topic) {
        this.consumerFactory = consumerFactory;
        this.topic = topic;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void loadHistory() {
        try (KafkaConsumer<String, HitEvent> consumer = (KafkaConsumer<String, HitEvent>) consumerFactory.createConsumer()) {
            consumer.subscribe(Collections.singletonList(topic));
            consumer.poll(Duration.ofMillis(0)); // trigger partition assignment
            consumer.seekToBeginning(consumer.assignment());

            ConsumerRecords<String, HitEvent> records = consumer.poll(Duration.ofSeconds(5));
            for (ConsumerRecord<String, HitEvent> record : records) {
                hits.add(record.value());
                logger.info("Loaded historic hit: blockId={}", record.value().blockId());
            }
            logger.info("Loaded {} historic hits from Kafka", hits.size());
        } catch (Exception e) {
            logger.error("Failed to load historic hits: {}", e.getMessage());
        }
    }

    @KafkaListener(topics = "${trading.kafka.topic}")
    public void consume(HitEvent hitEvent) {
        // Avoid duplicates from history load
        if (hits.stream().noneMatch(h -> h.blockId() == hitEvent.blockId())) {
            logger.info("Consumed hit: blockId={}", hitEvent.blockId());
            hits.add(hitEvent);
        }
    }

    public List<HitEvent> getAllHits() {
        return List.copyOf(hits);
    }
}
