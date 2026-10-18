package com.claudiordese.chat.infrastructure.configuration;

import com.claudiordese.chat.infrastructure.adapter.socket.RedisClusterEventSubscriber;
import com.claudiordese.chat.infrastructure.adapter.socket.WebSocketEventGateway;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Configuration
@EnableConfigurationProperties(SocketClusterProperties.class)
public class SocketClusterConfig {

    /** Subscribes this replica to the events the other replicas publish for sockets it may hold. */
    @Bean
    public RedisMessageListenerContainer socketEventListenerContainer(RedisConnectionFactory connectionFactory,
                                                                      ObjectMapper json,
                                                                      WebSocketEventGateway gateway,
                                                                      SocketClusterProperties properties) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(new RedisClusterEventSubscriber(json, gateway), new ChannelTopic(properties.channel()));
        return container;
    }
}
