package com.claudiordese.filters;

import com.claudiordese.security.JwtValidator;
import com.claudiordese.security.config.JwtSecurityProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collection;
import java.util.List;

/**
 * Handle behaviour of JWT
 */
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtFilter.class);
    private static final String BEARER_PREFIX = "Bearer ";
    private static final AntPathMatcher PATH_MATCHER = new AntPathMatcher();

    private final JwtValidator jwtValidator;
    private final JwtSecurityProperties properties;


    //No filter on public paths
    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getServletPath();
        return properties.getPublicPaths().stream().anyMatch(pattern -> PATH_MATCHER.match(pattern, path));
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain filterChain) throws ServletException, IOException {

        String token = resolveBearerToken(request);
        if (token == null) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            Claims claims = jwtValidator.validateToken(token);
            SecurityContextHolder.getContext().setAuthentication(toAuthentication(claims));
        } catch (JwtException ex) {
            SecurityContextHolder.clearContext();
            logger.debug("JWT rejected: {}", ex.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    //Return null if no valid bearer token is detected
    private String resolveBearerToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            return null;
        }
        String token = header.substring(BEARER_PREFIX.length()).trim();
        return token.isEmpty() ? null : token;
    }

    //Transforms JSON object properties of JWT to Authentication object of Spring Security
    private Authentication toAuthentication(Claims claims) {
        Collection<SimpleGrantedAuthority> authorities = extractRoles(claims).stream()
                .map(role -> new SimpleGrantedAuthority(properties.getRolePrefix() + role))
                .toList();
        var auth = new UsernamePasswordAuthenticationToken(claims.getSubject(), null, authorities);
        auth.setDetails(claims);
        return auth;
    }

    private List<String> extractRoles(Claims claims) {
        Object raw = claims.get(properties.getRolesClaim());
        if (raw instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        if (raw instanceof String s && !s.isBlank()) {
            return List.of(s.split("[,\\s]+"));
        }
        return List.of();
    }
}
