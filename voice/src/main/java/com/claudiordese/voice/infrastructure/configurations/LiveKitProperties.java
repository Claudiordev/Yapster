package com.claudiordese.voice.infrastructure.configurations;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * LiveKit connection settings.
 *
 * @param url       browser-reachable signaling URL the client SDK connects to
 *                  (e.g. {@code ws://localhost:7880}). Echoed back to the client;
 *                  the voice service itself never dials it.
 * @param apiKey    LiveKit API key; becomes the token issuer ({@code iss}) claim.
 * @param apiSecret LiveKit API secret; the HS256 signing key for access tokens.
 *                  Must be at least 32 bytes (jjwt rejects weaker HMAC keys).
 */
@ConfigurationProperties(prefix = "livekit")
public record LiveKitProperties(String url, String apiKey, String apiSecret) {
}
