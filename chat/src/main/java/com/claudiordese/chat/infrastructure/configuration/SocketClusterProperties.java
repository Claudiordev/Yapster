package com.claudiordese.chat.infrastructure.configuration;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

/**
 * Sharing the websocket sessions between replicas of the chat service through Redis.
 *
 * @param nodeId            identifies this replica (blank = random id per process)
 * @param connectionTtl     a connection that is not refreshed by its replica for this long
 *                          stops counting as online (covers a replica that crashed)
 * @param heartbeatInterval how often a replica refreshes its own connections, keep it well below the ttl
 * @param keyPrefix         prefix of every Redis key and of the pub/sub channel
 */
@Validated
@ConfigurationProperties(prefix = "chat.sockets")
public record SocketClusterProperties(
        @DefaultValue("") @NotNull String nodeId,
        @DefaultValue("30s") @NotNull Duration connectionTtl,
        @DefaultValue("10s") @NotNull Duration heartbeatInterval,
        @DefaultValue("chat:ws") @NotBlank String keyPrefix) {

    public String channel() {
        return keyPrefix + ":events";
    }
}
