package com.claudiordese.comms.infrastructure.kafka;

import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.support.serializer.JsonSerializer;

import java.util.HashMap;
import java.util.Map;

@Configuration
@ConditionalOnProperty(name = "spring.kafka.bootstrap-servers")
public class KafkaProducerConfig {

    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    private Map<String, Object> producerProps() {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        return props;
    }

    @Bean
    public ProducerFactory<String, MessageEvent> messageProducerFactory() {
        return new DefaultKafkaProducerFactory<>(producerProps());
    }

    @Bean
    public KafkaTemplate<String, MessageEvent> messageKafkaTemplate() {
        return new KafkaTemplate<>(messageProducerFactory());
    }

    @Bean
    public ProducerFactory<String, LogEvent> logProducerFactory() {
        return new DefaultKafkaProducerFactory<>(producerProps());
    }

    @Bean
    public KafkaTemplate<String, LogEvent> logKafkaTemplate() {
        return new KafkaTemplate<>(logProducerFactory());
    }
}
