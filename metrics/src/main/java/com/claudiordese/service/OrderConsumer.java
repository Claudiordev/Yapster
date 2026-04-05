package com.claudiordese.service;

import com.claudiordese.dto.OrderEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class OrderConsumer {

    private static final Logger logger = LoggerFactory.getLogger(OrderConsumer.class);

    private final List<OrderEvent> orders = new CopyOnWriteArrayList<>();

    @KafkaListener(topics = "${metrics.topics.orders}", containerFactory = "orderKafkaListenerContainerFactory")
    public void consume(OrderEvent orderEvent) {
            orders.add(orderEvent);
            logger.info("Consumed order: blockId={}, side={}, status={}, success={}",
                    orderEvent.blockId(), orderEvent.side(), orderEvent.status(), orderEvent.success());
    }

    public List<OrderEvent> getAllOrders() {
        return List.copyOf(orders);
    }

}
