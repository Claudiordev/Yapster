package com.claudiordese.voice.infrastructure.controllers.voice;

import com.claudiordese.voice.application.service.CallPresenceService;
import com.claudiordese.voice.application.service.ScreenShareEnforcementService;
import com.claudiordese.voice.infrastructure.configurations.LiveKitProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Receives LiveKit room events for ALL rooms: presence changes (join, leave, room finished) and
 * published tracks (screen-share resolution limits).
 * Only the fact that "room X changed" is used: the full participant list of that one
 * room is then read and sent to chat. Server-to-server only; the gateway must not
 * route this path from outside.
 */
@RestController
@RequestMapping("${url.api.base-path}/voice/livekit")
public class LiveKitWebhookController {

    private final CallPresenceService callPresence;
    private final ScreenShareEnforcementService screenShares;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final SecretKey signingKey;

    public LiveKitWebhookController(
            CallPresenceService callPresence,
            ScreenShareEnforcementService screenShares,
            ObjectMapper objectMapper,
            LiveKitProperties properties) {
        this.callPresence = callPresence;
        this.screenShares = screenShares;
        this.objectMapper = objectMapper;
        this.apiKey = properties.apiKey();
        this.signingKey = Keys.hmacShaKeyFor(
                properties.apiSecret().getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping
    public void receive(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody String body) {
        Claims claims = verifyWebhook(authorization, body);

        try {
            JsonNode payload = objectMapper.readTree(body);
            String event = payload.path("event").asText();

            if (event.equals("track_published")) {
                // The track's size is re-read from LiveKit; only "who, where" comes from the payload.
                String room = payload.path("room").path("name").asText();
                String identity = payload.path("participant").path("identity").asText();

                if (!room.isBlank() && !identity.isBlank()) screenShares.enforce(room, identity);
                return;
            }

            if (!event.equals("participant_joined")
                    && !event.equals("participant_left")
                    && !event.equals("room_finished")) {
                return;
            }

            String room = payload.path("room").path("name").asText();
            if (room.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing room name");
            }

            if (event.equals("room_finished")) {
                // The room may already have disappeared from LiveKit.
                callPresence.publishEmpty(room);
            } else {
                callPresence.publish(room);
            }
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid LiveKit webhook", error);
        }
    }

    private Claims verifyWebhook(String authorization, String body) {
        if (authorization == null || authorization.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing webhook signature");
        }

        // LiveKit sends the bare JWT; tolerate a "Bearer " prefix too.
        String token = authorization.startsWith("Bearer ")
                ? authorization.substring("Bearer ".length())
                : authorization;

        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(signingKey)
                    .requireIssuer(apiKey)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
            String expectedHash = claims.get("sha256", String.class);
            String actualHash = java.util.Base64.getEncoder().encodeToString(
                    MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8)));

            if (expectedHash == null || !MessageDigest.isEqual(
                    expectedHash.getBytes(StandardCharsets.US_ASCII),
                    actualHash.getBytes(StandardCharsets.US_ASCII))) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid webhook signature");
            }
            return claims;
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid webhook signature", error);
        }
    }
}
