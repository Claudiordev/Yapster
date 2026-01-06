package com.claudiordese.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class Rest {

    @Bean
    RestClient twilioRestClient (RestClient.Builder builder, @Value("${twilio.sid}") String sid, @Value("${twilio.auth_token}") String authToken) {
        var factory = new HttpComponentsClientHttpRequestFactory();
        factory.setConnectionRequestTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(5));

        return builder.baseUrl("https://api.twilio.com")
                .defaultHeaders(headers-> headers.setBasicAuth(sid, authToken))
                .requestFactory(factory)
                .build();
    }
}
