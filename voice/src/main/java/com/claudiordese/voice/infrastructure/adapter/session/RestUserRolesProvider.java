package com.claudiordese.voice.infrastructure.adapter.session;

import com.claudiordese.voice.application.port.UserRolesProvider;
import com.claudiordese.voice.infrastructure.configurations.InternalProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Set;

/** Reads a user's current roles from the session service (Eureka name "session"), not from a token. */
@Component
public class RestUserRolesProvider implements UserRolesProvider {

    private record RolesResponse(List<String> roles) {}

    private final RestClient session;
    private final String secret;

    public RestUserRolesProvider(RestClient.Builder loadBalancedRestClientBuilder, InternalProperties properties) {
        this.session = loadBalancedRestClientBuilder.baseUrl("http://session/api/v1").build();
        this.secret = properties.secret();
    }

    @Override
    public Set<String> rolesOf(String userId) {
        RolesResponse response = session.get()
                .uri("/internal/users/{userId}/roles", userId)
                .header("X-Internal-Secret", secret == null ? "" : secret)
                .retrieve()
                .body(RolesResponse.class);

        return response == null || response.roles() == null ? Set.of() : Set.copyOf(response.roles());
    }
}
