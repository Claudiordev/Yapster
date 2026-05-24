package com.claudiordese.comms.service;

import com.claudiordese.comms.dto.LogEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "spring.kafka.bootstrap-servers")
public class LogConsumer {

    private static final Logger logger = LoggerFactory.getLogger(LogConsumer.class);

    @KafkaListener(
            topics = "${comms.kafka.topics.logs:comms-logs}",
            containerFactory = "logKafkaListenerContainerFactory")
    public void consume(LogEvent event) {
        logger.info("[comms-log] {} action={} actor={} messageId={} detail={}",
                event.level(), event.action(), event.actor(), event.messageId(), event.detail());
    }
}
