package com.claudiordese.chat.infrastructure.adapter.socket;

import com.claudiordese.chat.infrastructure.configuration.SocketClusterProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class RedisClusterEventPublisher implements ClusterEventPublisher {

    private final StringRedisTemplate redis;
    private final ObjectMapper json;
    private final String channel;

    public RedisClusterEventPublisher(StringRedisTemplate redis, ObjectMapper json, SocketClusterProperties properties) {
        this.redis = redis;
        this.json = json;
        this.channel = properties.channel();
    }

    @Override
    public void publish(ClusterEnvelope envelope) {
        try {
            redis.convertAndSend(channel, json.writeValueAsString(envelope));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize cluster envelope for " + envelope.userId(), e);
        }
    }
}
