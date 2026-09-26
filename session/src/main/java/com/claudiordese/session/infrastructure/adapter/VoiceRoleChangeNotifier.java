package com.claudiordese.session.infrastructure.adapter;

import com.claudiordese.session.application.port.RoleChangeNotifier;
import com.claudiordese.session.infrastructure.configurations.InternalProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.UUID;

/**
 * Asks the voice service to re-check the user's live screen shares against their
 * new roles, so a downgrade takes effect mid-call instead of at the next share.
 */
@Component
public class VoiceRoleChangeNotifier implements RoleChangeNotifier {

    private static final Logger log = LoggerFactory.getLogger(VoiceRoleChangeNotifier.class);

    private final RestClient voice;
    private final String secret;

    public VoiceRoleChangeNotifier(RestClient.Builder loadBalancedRestClientBuilder, InternalProperties properties) {
        this.voice = loadBalancedRestClientBuilder.baseUrl("http://voice/api/v1").build();
        this.secret = properties.secret();
    }

    @Override
    public void rolesChanged(UUID userId) {
        if (secret == null || secret.isBlank()) {
            log.warn("INTERNAL_SECRET not configured; skipping voice roles-changed for {}", userId);
            return;
        }

        try {
            voice.post()
                    .uri("/internal/voice/users/{userId}/roles-changed", userId)
                    .header("X-Internal-Secret", secret)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Could not push roles-changed to voice for {}: {}", userId, e.getMessage());
        }
    }
}
