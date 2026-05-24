package com.claudiordese.comms.infrastructure.configurations;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class RestClientConfig {

    @Bean
    RestClient commsRestClient(RestClient.Builder builder,
                               @Value("${comms.provider.base-url:https://api.twilio.com}") String baseUrl,
                               @Value("${comms.provider.sid}") String sid,
                               @Value("${comms.provider.auth_token}") String authToken) {
        var factory = new HttpComponentsClientHttpRequestFactory();
        factory.setConnectionRequestTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(5));

        return builder.baseUrl(baseUrl)
                .defaultHeaders(headers -> headers.setBasicAuth(sid, authToken))
                .requestFactory(factory)
                .build();
    }
}
