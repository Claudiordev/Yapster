package com.claudiordese.voice.infrastructure.controllers.voice;

import com.claudiordese.voice.application.service.RoomService;
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
import java.util.HexFormat;

/** Receives LiveKit room presence changes and forwards fresh counts to chat. */
@RestController
@RequestMapping("${url.api.base-path}/voice/livekit")
public class LiveKitWebhookController {

    private final RoomService roomService;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final SecretKey signingKey;

    public LiveKitWebhookController(
            RoomService roomService, ObjectMapper objectMapper, LiveKitProperties properties) {
        this.roomService = roomService;
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
                roomService.publishEmptyStatus(room);
            } else {
                roomService.publishStatus(room);
            }
        } catch (ResponseStatusException error) {
            throw error;
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid LiveKit webhook", error);
        }
    }

    private Claims verifyWebhook(String authorization, String body) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing webhook signature");
        }

        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(signingKey)
                    .requireIssuer(apiKey)
                    .build()
                    .parseClaimsJws(authorization.substring("Bearer ".length()))
                    .getBody();
            String expectedHash = claims.get("sha256", String.class);
            String actualHash = HexFormat.of().formatHex(
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
