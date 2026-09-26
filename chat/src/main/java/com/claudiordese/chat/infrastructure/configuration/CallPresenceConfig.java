package com.claudiordese.chat.infrastructure.configuration;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(CallPresenceProperties.class)
public class CallPresenceConfig {
}
