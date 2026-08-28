package com.claudiordese.chat.infrastructure.configuration;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Validated
@ConfigurationProperties(prefix = "rate-limiting.message")
public record RateLimitingProperties(
        @DefaultValue("20") @Min(1) int maxAttempts,
        @DefaultValue("10s") @NotNull Duration window) {}
