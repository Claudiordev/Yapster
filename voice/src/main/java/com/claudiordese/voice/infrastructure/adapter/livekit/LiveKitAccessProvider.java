package com.claudiordese.voice.infrastructure.adapter.livekit;

import com.claudiordese.voice.application.domain.rooms.RoomAccess;
import com.claudiordese.voice.application.port.RoomAccessProvider;
import com.claudiordese.voice.infrastructure.configurations.LiveKitProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

/**
 * LiveKit adapter for {@link RoomAccessProvider}.
 *
 * A LiveKit access token is just a JWT signed HS256 with the API secret, whose
 * {@code iss} is the API key, {@code sub} is the participant identity, and whose
 * {@code video} claim carries the grant (which room, and what the participant
 * may do there). We mint it with jjwt directly — same library the rest of the
 * platform uses — rather than pull in the LiveKit server SDK.
 *
 * Note this token is unrelated to the session's RS256 auth JWT: that one proves
 * <em>who you are</em> (and is validated before this endpoint runs); this one
 * authorises <em>media access to one room</em> and is consumed only by LiveKit.
 */
@Component
public class LiveKitAccessProvider implements RoomAccessProvider {

    /** Long enough to outlast a call; the client refreshes by re-requesting. */
    private static final Duration TOKEN_TTL = Duration.ofHours(6);

    private final String serverUrl;
    private final String apiKey;
    private final SecretKey signingKey;

    public LiveKitAccessProvider(LiveKitProperties properties) {
        this.serverUrl = properties.url();
        this.apiKey = properties.apiKey();
        // Throws WeakKeyException at startup if the secret is < 32 bytes — fail fast.
        this.signingKey = Keys.hmacShaKeyFor(properties.apiSecret().getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public RoomAccess accessFor(String identity, String room) {
        Instant now = Instant.now();

        Map<String, Object> videoGrant = Map.of(
                "room", room,
                "roomJoin", true,
                "canPublish", true,
                "canSubscribe", true,
                "canPublishData", true
        );

        String token = Jwts.builder()
                .setIssuer(apiKey)
                .setSubject(identity)
                .claim("name", identity)
                .claim("video", videoGrant)
                .setIssuedAt(Date.from(now))
                .setNotBefore(Date.from(now))
                .setExpiration(Date.from(now.plus(TOKEN_TTL)))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();

        return new RoomAccess(serverUrl, token, room, identity);
    }
}
