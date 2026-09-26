package com.claudiordese.voice.infrastructure.controllers.voice;

import com.claudiordese.voice.application.service.ScreenShareEnforcementService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Service-to-service endpoints, authenticated by the shared secret in
 * {@link com.claudiordese.voice.infrastructure.security.InternalSecretInterceptor}.
 * The gateway only maps {@code /voice/**} to {@code /api/v1/voice/**}, so this is not reachable from outside.
 */
@RestController
@RequestMapping("${url.api.base-path}/internal/voice")
public class InternalVoiceController {

    private final ScreenShareEnforcementService screenShares;

    public InternalVoiceController(ScreenShareEnforcementService screenShares) {
        this.screenShares = screenShares;
    }

    /** Session pushes this when a user's roles change; their live screen shares are re-checked. */
    @PostMapping("/users/{userId}/roles-changed")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void rolesChanged(@PathVariable String userId) {
        screenShares.enforceEverywhere(userId);
    }
}
