package com.claudiordese.session.util;

import org.springframework.security.core.Authentication;

import java.util.UUID;

public final class AuthenticationUtils {

    private AuthenticationUtils() {}

    public static UUID currentUserId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }
}
