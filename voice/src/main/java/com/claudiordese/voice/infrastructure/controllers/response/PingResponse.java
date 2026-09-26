package com.claudiordese.voice.infrastructure.controllers.response;

/** Tiny payload for latency probes; {@code serverTime} is epoch millis on the voice service. */
public record PingResponse(long serverTime) {
}
