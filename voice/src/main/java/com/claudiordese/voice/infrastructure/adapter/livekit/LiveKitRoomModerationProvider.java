package com.claudiordese.voice.infrastructure.adapter.livekit;

import com.claudiordese.exceptions.NotFoundException;
import com.claudiordese.exceptions.ServiceUnavailableException;
import com.claudiordese.voice.application.port.RoomModerationProvider;
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

/** Applies moderator actions through LiveKit's authenticated RoomService API. */
@Component
public class LiveKitRoomModerationProvider implements RoomModerationProvider {

    private final URI getParticipantUri;
    private final URI muteTrackUri;
    private final String apiKey;
    private final SecretKey signingKey;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public LiveKitRoomModerationProvider(
            LiveKitProperties properties,
            ObjectMapper objectMapper) {
        this.getParticipantUri = roomServiceUri(properties.url(), "GetParticipant");
        this.muteTrackUri = roomServiceUri(properties.url(), "MutePublishedTrack");
        this.apiKey = properties.apiKey();
        this.signingKey = Keys.hmacShaKeyFor(
                properties.apiSecret().getBytes(StandardCharsets.UTF_8));
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    @Override
    public void muteMicrophone(String room, String participantIdentity) {
        JsonNode participant = post(
                getParticipantUri,
                room,
                Map.of("room", room, "identity", participantIdentity));
        String microphoneTrackSid = microphoneTrackSid(participant);

        if (microphoneTrackSid == null) {
            throw new NotFoundException(
                    "microphone_not_found",
                    "The participant does not have a microphone track in this call");
        }

        post(
                muteTrackUri,
                room,
                Map.of(
                        "room", room,
                        "identity", participantIdentity,
                        "track_sid", microphoneTrackSid,
                        "muted", true));
    }

    private JsonNode post(URI uri, String room, Map<String, Object> payload) {
        try {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(5))
                    .header("Authorization", "Bearer " + adminToken(room))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(
                            objectMapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 404) {
                throw new NotFoundException(
                        "participant_not_in_call",
                        "The participant is no longer in this call");
            }
            if (response.statusCode() / 100 != 2) {
                throw new ServiceUnavailableException(
                        "livekit_moderation_failed",
                        "LiveKit rejected the call moderation request");
            }

            return response.body().isBlank()
                    ? objectMapper.createObjectNode()
                    : objectMapper.readTree(response.body());
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new ServiceUnavailableException(
                    "livekit_moderation_interrupted",
                    "LiveKit call moderation was interrupted");
        } catch (NotFoundException | ServiceUnavailableException error) {
            throw error;
        } catch (Exception error) {
            throw new ServiceUnavailableException(
                    "livekit_moderation_unavailable",
                    "Could not reach LiveKit to moderate this call");
        }
    }

    private static String microphoneTrackSid(JsonNode participant) {
        for (JsonNode track : participant.path("tracks")) {
            JsonNode source = track.path("source");
            if ("MICROPHONE".equals(source.asText()) || source.asInt(-1) == 2) {
                String sid = track.path("sid").asText();
                return sid.isBlank() ? null : sid;
            }
        }
        return null;
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

    private static URI roomServiceUri(String serverUrl, String operation) {
        URI configured = URI.create(serverUrl);
        String scheme = switch (configured.getScheme()) {
            case "ws" -> "http";
            case "wss" -> "https";
            default -> configured.getScheme();
        };
        return URI.create(scheme + "://" + configured.getRawAuthority()
                + "/twirp/livekit.RoomService/" + operation);
    }
}
