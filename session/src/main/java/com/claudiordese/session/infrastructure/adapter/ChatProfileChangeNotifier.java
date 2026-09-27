package com.claudiordese.session.infrastructure.adapter;

import com.claudiordese.session.application.port.ProfileChangeNotifier;
import com.claudiordese.session.infrastructure.configurations.InternalProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.UUID;

/**
 * Asks the chat service to push PROFILE_CHANGED to everyone who shares a conversation with the
 * user. Best effort: a failed push only means others see the change on their next reload.
 */
@Component
public class ChatProfileChangeNotifier implements ProfileChangeNotifier {

    private static final Logger log = LoggerFactory.getLogger(ChatProfileChangeNotifier.class);

    private final RestClient chat;
    private final String secret;

    public ChatProfileChangeNotifier(RestClient.Builder loadBalancedRestClientBuilder, InternalProperties properties) {
        this.chat = loadBalancedRestClientBuilder.baseUrl("http://chat/api/v1").build();
        this.secret = properties.secret();
    }

    @Override
    public void profileChanged(UUID userId) {
        if (secret == null || secret.isBlank()) {
            log.warn("INTERNAL_SECRET not configured; skipping profile-changed push for {}", userId);
            return;
        }

        try {
            chat.post()
                    .uri("/internal/chat/users/{userId}/profile-changed", userId)
                    .header("X-Internal-Secret", secret)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Could not push profile-changed for {}: {}", userId, e.getMessage());
        }
    }
}
