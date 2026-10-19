package com.claudiordese.chat.infrastructure.adapter.socket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;

import java.nio.charset.StandardCharsets;

/** Receives what other replicas published and delivers it to the sockets held by this one. */
public class RedisClusterEventSubscriber implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(RedisClusterEventSubscriber.class);

    private final ObjectMapper json;
    private final WebSocketEventGateway gateway;

    public RedisClusterEventSubscriber(ObjectMapper json, WebSocketEventGateway gateway) {
        this.json = json;
        this.gateway = gateway;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            gateway.deliverFromCluster(json.readValue(new String(message.getBody(), StandardCharsets.UTF_8), ClusterEnvelope.class));
        } catch (Exception e) {
            log.warn("Dropping unreadable cluster event: {}", e.getMessage());
        }
    }
}
