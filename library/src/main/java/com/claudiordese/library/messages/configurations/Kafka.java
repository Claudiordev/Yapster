package com.claudiordese.library.messages.configurations;

import com.claudiordese.library.old.RoomsStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.listener.adapter.RecordFilterStrategy;

@Configuration
public class Kafka {

    //Discard rooms with players = 0
    @Bean
    public RecordFilterStrategy<String, RoomsStatus> filterFullRooms() {
        return record -> record.value().getRooms()
                .stream().allMatch(room -> room.getPlayers() == 0);
    }

    //Declare kafkaListenerContainerFactory with the filter
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, RoomsStatus> kafkaListenerContainerFactory(
            ConsumerFactory<String, RoomsStatus> consumerFactory,
            RecordFilterStrategy<String, RoomsStatus> filterFullRooms) {

        ConcurrentKafkaListenerContainerFactory<String, RoomsStatus> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);

        // Only receive rooms where all rooms have 2 players
        factory.setRecordFilterStrategy(filterFullRooms);

        return factory;
    }
}
