package com.claudiordese.session.infrastructure.configurations;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Validated
@ConfigurationProperties(prefix = "rate-limiting")
public record RateLimitingProperties(
        @Valid @NotNull Limit login,
        @Valid @NotNull Limit register,
        @Valid @NotNull Limit fileUpload) {

    public record Limit(
            @Min(1) int maxAttempts,
            @NotNull Duration window) {}
}
