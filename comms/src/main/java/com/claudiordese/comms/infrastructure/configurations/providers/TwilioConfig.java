package com.claudiordese.comms.infrastructure.configurations.providers;

import com.twilio.Twilio;
import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(TwilioProperties.class)
public class TwilioConfig {

    private final TwilioProperties properties;

    public TwilioConfig(TwilioProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    void init() {
        Twilio.init(properties.accountSid(), properties.authToken());
    }
}
