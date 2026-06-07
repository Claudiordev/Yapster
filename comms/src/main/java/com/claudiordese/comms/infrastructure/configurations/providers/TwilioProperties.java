package com.claudiordese.comms.infrastructure.configurations.providers;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "twilio")
public record TwilioProperties(
        String accountSid,
        String authToken,
        String senderPhoneNumber) {}
