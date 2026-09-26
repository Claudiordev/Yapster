package com.claudiordese.voice.infrastructure.adapter.livekit;

import com.claudiordese.voice.application.domain.rooms.ScreenShareTrack;
import com.claudiordese.voice.application.port.ScreenShareControl;
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
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

/** Reads and suspends screen shares through LiveKit's authenticated RoomService API. */
@Component
public class LiveKitScreenShareControl implements ScreenShareControl {

    private final String baseUri;
    private final String apiKey;
    private final SecretKey signingKey;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public LiveKitScreenShareControl(LiveKitProperties properties, ObjectMapper objectMapper) {
        URI configured = URI.create(properties.url());
        String scheme = switch (configured.getScheme()) {
            case "ws" -> "http";
            case "wss" -> "https";
            default -> configured.getScheme();
        };
        this.baseUri = scheme + "://" + configured.getRawAuthority() + "/twirp/livekit.RoomService/";
        this.apiKey = properties.apiKey();
        this.signingKey = Keys.hmacShaKeyFor(properties.apiSecret().getBytes(StandardCharsets.UTF_8));
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    }

    @Override
    public List<String> activeRooms() {
        JsonNode response = post("ListRooms", Map.of("roomList", true), Map.of());
        List<String> rooms = new ArrayList<>();

        response.path("rooms").forEach(room -> {
            String name = room.path("name").asText("");

            if (!name.isBlank()) rooms.add(name);
        });
        return rooms;
    }

    @Override
    public List<ScreenShareTrack> screenSharesOf(String room, String identity) {
        JsonNode participant = post(
                "GetParticipant",
                Map.of("room", room, "roomAdmin", true),
                Map.of("room", room, "identity", identity));
        List<ScreenShareTrack> shares = new ArrayList<>();

        for (JsonNode track : participant.path("tracks")) {
            if (!isVideo(track) || !isScreenShare(track)) continue;

            shares.add(new ScreenShareTrack(track.path("sid").asText(), declaredWidth(track), declaredHeight(track)));
        }
        return shares;
    }

    @Override
    public void suspend(String room, String identity, String trackSid) {
        post("MutePublishedTrack",
                Map.of("room", room, "roomAdmin", true),
                Map.of("room", room, "identity", identity, "track_sid", trackSid, "muted", true));
    }

    // protojson renders enums as names, but tolerate numbers (VIDEO = 1, SCREEN_SHARE = 3).
    private static boolean isVideo(JsonNode track) {
        JsonNode type = track.path("type");

        return "VIDEO".equals(type.asText()) || type.asInt(-1) == 1;
    }

    private static boolean isScreenShare(JsonNode track) {
        JsonNode source = track.path("source");

        return "SCREEN_SHARE".equals(source.asText()) || source.asInt(-1) == 3;
    }

    /** The largest size the publisher declared, across the track and any layers. */
    private static int declaredWidth(JsonNode track) {
        int width = track.path("width").asInt(0);

        for (JsonNode layer : track.path("layers")) width = Math.max(width, layer.path("width").asInt(0));
        return width;
    }

    private static int declaredHeight(JsonNode track) {
        int height = track.path("height").asInt(0);

        for (JsonNode layer : track.path("layers")) height = Math.max(height, layer.path("height").asInt(0));
        return height;
    }

    /** A participant that has left answers 404; callers see that as "no shares". */
    private JsonNode post(String operation, Map<String, Object> grant, Map<String, Object> payload) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUri + operation))
                    .timeout(Duration.ofSeconds(5))
                    .header("Authorization", "Bearer " + adminToken(grant))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 404) return objectMapper.createObjectNode();
            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException("LiveKit " + operation + " returned HTTP " + response.statusCode());
            }
            return response.body().isBlank() ? objectMapper.createObjectNode() : objectMapper.readTree(response.body());
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("LiveKit " + operation + " was interrupted", error);
        } catch (IllegalStateException error) {
            throw error;
        } catch (Exception error) {
            throw new IllegalStateException("Could not reach LiveKit for " + operation, error);
        }
    }

    private String adminToken(Map<String, Object> grant) {
        Instant now = Instant.now();

        return Jwts.builder()
                .setIssuer(apiKey)
                .setSubject("voice-service")
                .claim("video", grant)
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(now.plusSeconds(60)))
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }
}
