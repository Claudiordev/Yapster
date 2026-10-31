package com.claudiordese.chat.infrastructure.configuration;

import com.claudiordese.chat.application.config.ReactionPolicy;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ReactionProperties.class)
public class ReactionConfig {

    @Bean
    public ReactionPolicy reactionPolicy(ReactionProperties properties) {
        return new ReactionPolicy(properties.maxDistinct());
    }
}
