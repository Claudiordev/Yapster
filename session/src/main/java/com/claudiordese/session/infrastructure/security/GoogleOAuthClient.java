package com.claudiordese.session.infrastructure.security;

import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.session.application.domain.GoogleIdentity;
import com.claudiordese.session.application.port.GoogleIdentityClient;
import com.claudiordese.session.infrastructure.configurations.GoogleAuthProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Instant;

/**
 * Talks to Google's token endpoint. Uses a plain RestClient, NOT the load-balanced
 * builder configured for chat: that one would try to resolve googleapis.com in Eureka.
 */
@Component
public class GoogleOAuthClient implements GoogleIdentityClient {

    static final String TOKEN_URL = "https://oauth2.googleapis.com/token";

    private final GoogleAuthProperties properties;
    private final GoogleIdTokenValidator validator;
    private final RestClient http = RestClient.create();
    private final ObjectMapper json;

    public GoogleOAuthClient(GoogleAuthProperties properties, ObjectMapper json) {
        this.properties = properties;
        this.json = json;
        this.validator = new GoogleIdTokenValidator(json, properties.clientId());
    }

    @Override
    public GoogleIdentity exchange(String code, String redirectUri, String codeVerifier, String expectedNonce) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();

        form.add("code", code);
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());
        form.add("redirect_uri", redirectUri);
        form.add("grant_type", "authorization_code");
        form.add("code_verifier", codeVerifier);

        String body;
        try {
            body = http.post()
                    .uri(TOKEN_URL)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException e) {
            throw new InvalidAuthorizationException("google_exchange_failed",
                    "Google rejected the sign-in (" + e.getStatusCode().value() + ")");
        } catch (RuntimeException e) {
            throw new InvalidAuthorizationException("google_unreachable", "Could not reach Google. Please try again.");
        }

        try {
            JsonNode response = json.readTree(body);
            String idToken = response.path("id_token").asText("");

            if (idToken.isBlank()) throw new InvalidAuthorizationException("google_exchange_failed", "Google returned no ID token");
            return validator.validate(idToken, expectedNonce, Instant.now());
        } catch (InvalidAuthorizationException e) {
            throw e;
        } catch (Exception e) {
            throw new InvalidAuthorizationException("google_exchange_failed", "Could not read Google's response");
        }
    }
}
