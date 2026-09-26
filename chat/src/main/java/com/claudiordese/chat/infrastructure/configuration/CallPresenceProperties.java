package com.claudiordese.chat.infrastructure.configuration;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

/**
 * Who-is-in-the-call presence for conversations.
 *
 * @param maxBroadcastMembers conversations with MORE members than this get no live push
 *                            (clients read the snapshot when they load/open instead)
 * @param batchWindow         changes arriving within this window are sent as one update
 * @param ttl                 safety net: a snapshot nobody refreshed expires after this
 */
@Validated
@ConfigurationProperties(prefix = "chat.call-presence")
public record CallPresenceProperties(
        @DefaultValue("20") @Min(1) int maxBroadcastMembers,
        @DefaultValue("1s") @NotNull Duration batchWindow,
        @DefaultValue("6h") @NotNull Duration ttl) {}
