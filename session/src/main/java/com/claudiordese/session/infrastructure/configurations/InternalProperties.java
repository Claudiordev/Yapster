package com.claudiordese.session.infrastructure.configurations;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Shared secret for service-to-service calls into chat's internal endpoints. */
@ConfigurationProperties(prefix = "internal")
public record InternalProperties(String secret) {
}
