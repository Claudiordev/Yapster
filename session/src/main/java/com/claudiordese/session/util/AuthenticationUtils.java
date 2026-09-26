package com.claudiordese.session.util;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

public final class AuthenticationUtils {

    private static final String ROLE_PREFIX = "ROLE_";

    private AuthenticationUtils() {}

    public static UUID currentUserId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }

    /** The caller's roles from the token, without the ROLE_ prefix (e.g. "PREMIUM"). */
    public static Set<String> currentRoles(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(authority -> authority.startsWith(ROLE_PREFIX) ? authority.substring(ROLE_PREFIX.length()) : authority)
                .collect(Collectors.toSet());
    }
}
