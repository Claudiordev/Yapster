package com.claudiordese.comms.dto;

import java.time.Instant;

public record LogEvent(
        String level,
        String action,
        String actor,
        String messageId,
        String detail,
        Instant occurredAt) {

    public static LogEvent info(String action, String actor, String messageId, String detail) {
        return new LogEvent("INFO", action, actor, messageId, detail, Instant.now());
    }

    public static LogEvent error(String action, String actor, String messageId, String detail) {
        return new LogEvent("ERROR", action, actor, messageId, detail, Instant.now());
    }
}
