package com.claudiordese.chat.infrastructure.configuration;

import com.claudiordese.chat.application.config.MessageRateLimitPolicy;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(RateLimitingProperties.class)
public class RateLimitingConfig {

    @Bean
    public MessageRateLimitPolicy messageRateLimitPolicy(RateLimitingProperties properties) {
        return new MessageRateLimitPolicy(properties.maxAttempts(), properties.window());
    }
}
