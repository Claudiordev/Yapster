package com.claudiordese.voice.infrastructure.adapter.livekit;

import com.claudiordese.voice.application.port.RoomPresenceProvider;
import com.claudiordese.voice.infrastructure.configurations.LiveKitProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

/** Queries LiveKit's authoritative list of currently connected participants. */
@Component
public class LiveKitRoomPresenceProvider implements RoomPresenceProvider {

    private final URI listParticipantsUri;
    private final String apiKey;
    private final SecretKey signingKey;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public LiveKitRoomPresenceProvider(LiveKitProperties properties, ObjectMapper objectMapper) {
        this.listParticipantsUri = roomServiceUri(properties.url());
        this.apiKey = properties.apiKey();
        this.signingKey = Keys.hmacShaKeyFor(properties.apiSecret().getBytes(StandardCharsets.UTF_8));
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    @Override
    public int participantCount(String room) {
        try {
            String body = objectMapper.writeValueAsString(Map.of("room", room));
            HttpRequest request = HttpRequest.newBuilder(listParticipantsUri)
                    .timeout(Duration.ofSeconds(5))
                    .header("Authorization", "Bearer " + adminToken(room))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(
                    request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException(
                        "LiveKit ListParticipants returned HTTP " + response.statusCode());
            }

            JsonNode participants = objectMapper.readTree(response.body()).path("participants");
            return participants.isArray() ? participants.size() : 0;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("LiveKit participant lookup was interrupted", error);
        } catch (Exception error) {
            throw new IllegalStateException("Could not read LiveKit room participants", error);
        }
    }

    private String adminToken(String room) {
        Instant now = Instant.now();
        return Jwts.builder()
                .setIssuer(apiKey)
                .setSubject("voice-service")
                .claim("video", Map.of("room", room, "roomAdmin", true))
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(now.plusSeconds(60)))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    private static URI roomServiceUri(String serverUrl) {
        URI configured = URI.create(serverUrl);
        String scheme = switch (configured.getScheme()) {
            case "ws" -> "http";
            case "wss" -> "https";
            default -> configured.getScheme();
        };
        return URI.create(scheme + "://" + configured.getRawAuthority()
                + "/twirp/livekit.RoomService/ListParticipants");
    }
}
