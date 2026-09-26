package com.claudiordese.voice.infrastructure.security;

import com.claudiordese.voice.infrastructure.configurations.InternalProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Authenticates service-to-service calls: every request under the internal path
 * must carry the shared secret in {@code X-Internal-Secret}. Registered for the
 * internal path only (see {@link InternalSecretWebConfig}), so the internal
 * controllers contain no credential handling.
 *
 * Fails closed: an unset or blank secret rejects everything.
 */
@Component
public class InternalSecretInterceptor implements HandlerInterceptor {

    static final String HEADER = "X-Internal-Secret";

    private final byte[] expected;

    public InternalSecretInterceptor(InternalProperties properties) {
        String secret = properties.secret();

        this.expected = secret == null || secret.isBlank() ? null : secret.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String provided = request.getHeader(HEADER);

        if (expected == null || provided == null
                || !MessageDigest.isEqual(expected, provided.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid service credentials");
        }
        return true;
    }
}
