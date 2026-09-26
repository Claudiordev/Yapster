package com.claudiordese.session.infrastructure.adapter;

import com.claudiordese.session.application.port.RoleChangeNotifier;
import com.claudiordese.session.infrastructure.configurations.InternalProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.UUID;

/**
 * Asks the chat service to push a ROLES_CHANGED event to the user.
 */
@Component
public class ChatRoleChangeNotifier implements RoleChangeNotifier {

    private static final Logger log = LoggerFactory.getLogger(ChatRoleChangeNotifier.class);

    private final RestClient chat;
    private final String secret;

    public ChatRoleChangeNotifier(RestClient.Builder loadBalancedRestClientBuilder, InternalProperties properties) {
        this.chat = loadBalancedRestClientBuilder.baseUrl("http://chat/api/v1").build();
        this.secret = properties.secret();
    }

    @Override
    public void rolesChanged(UUID userId) {
        if (secret == null || secret.isBlank()) {
            log.warn("INTERNAL_SECRET not configured; skipping roles-changed push for {}", userId);
            return;
        }

        try {
            chat.post()
                    .uri("/internal/chat/users/{userId}/roles-changed", userId)
                    .header("X-Internal-Secret", secret)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Could not push roles-changed for {}: {}", userId, e.getMessage());
        }
    }
}
