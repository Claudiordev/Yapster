package com.claudiordese.voice.infrastructure.configurations;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(LiveKitProperties.class)
public class LiveKitConfig {
}
