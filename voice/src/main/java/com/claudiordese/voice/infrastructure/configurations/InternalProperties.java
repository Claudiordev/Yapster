package com.claudiordese.voice.infrastructure.configurations;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "internal")
public record InternalProperties(String secret) {
}
