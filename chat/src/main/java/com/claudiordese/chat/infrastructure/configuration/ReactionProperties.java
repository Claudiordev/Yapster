package com.claudiordese.chat.infrastructure.configuration;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "reaction")
public record ReactionProperties(
        @DefaultValue("20") @Min(1) int maxDistinct) {}
