package com.claudiordese.session.infrastructure.controllers;

import com.claudiordese.session.application.service.UserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Service-to-service endpoints, authenticated by the shared secret in
 * {@link com.claudiordese.session.infrastructure.security.InternalSecretInterceptor}.
 * Not reachable through the gateway.
 */
@RestController
@RequestMapping("${url.api.base-path}/internal/users")
public class InternalUserController {

    public record RolesResponse(List<String> roles) {}

    private final UserService userService;

    public InternalUserController(UserService userService) {
        this.userService = userService;
    }

    /** A user's roles as stored right now. Other services use this instead of trusting a JWT that may be stale. */
    @GetMapping("/{userId}/roles")
    public RolesResponse roles(@PathVariable UUID userId) {
        return new RolesResponse(userService.rolesOf(userId));
    }
}
