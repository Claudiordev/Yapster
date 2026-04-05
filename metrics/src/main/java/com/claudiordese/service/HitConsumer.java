package com.claudiordese.service;

import com.claudiordese.dto.HitEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class HitConsumer {

    private static final Logger logger = LoggerFactory.getLogger(HitConsumer.class);

    private final List<HitEvent> hits = new CopyOnWriteArrayList<>();

    //TODO If multiple concurrent threads reading the topic, then duplicate values could go on the list, update this part later
    @KafkaListener(topics = "${metrics.topics.hits}", containerFactory = "hitKafkaListenerContainerFactory")
    public void consume(HitEvent hitEvent) {
        if (hits.stream().noneMatch(h -> h.blockId() == hitEvent.blockId())) {
            hits.add(hitEvent);
            logger.info("Consumed hit: blockId={}, hitPrice={}, targetPrice={}",
                    hitEvent.blockId(), hitEvent.hitPrice(), hitEvent.targetPrice());
        }
    }

    public List<HitEvent> getAllHits() {
        return List.copyOf(hits);
    }
}
