package com.claudiordese.comms.infrastructure.kafka;

import java.time.Instant;

public record MessageEvent(
        String messageId,
        String sender,
        String receiver,
        String status,
        String providerId,
        Instant occurredAt) {}
