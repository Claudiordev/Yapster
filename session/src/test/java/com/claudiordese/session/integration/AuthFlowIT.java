package com.claudiordese.session.integration;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end HTTP integration test for the auth flow.
 *
 * Boots the full Spring context with a real Tomcat on a random port, talks to a
 * real Postgres in a Testcontainer, exercises the real JWT signing with the
 * actual private key, real BCrypt, real Hibernate mapping. Verifies the
 * register → login → refresh → logout flow as a black box over HTTP.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class AuthFlowIT {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("session_test")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void overrideProps(DynamicPropertyRegistry registry) {
        // Point the app at the Testcontainer Postgres
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);

        // Let Hibernate build the schema for the test DB
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");

        // Don't try to reach Eureka in tests
        registry.add("eureka.client.enabled", () -> "false");
        registry.add("eureka.client.register-with-eureka", () -> "false");
        registry.add("eureka.client.fetch-registry", () -> "false");
    }

    @LocalServerPort int port;

    @Autowired TestRestTemplate http;

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    @Test
    void register_then_login_then_refresh_then_logout() {
        // Arrange — unique credentials per test run
        String username = "alice_" + UUID.randomUUID().toString().substring(0, 8);
        String email    = username + "@example.com";
        String password = "secret12345";

        // ─── 1. Register ────────────────────────────────────────────────
        Map<String, String> registerBody = Map.of(
                "username", username,
                "email", email,
                "confirmEmail", email,
                "password", password);

        ResponseEntity<JsonNode> registerResp = http.postForEntity(
                url("/api/v1/auth/register"), registerBody, JsonNode.class);

        assertThat(registerResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(registerResp.getHeaders().getLocation()).isNotNull();
        assertThat(registerResp.getBody().get("username").asText()).isEqualTo(username);
        assertThat(registerResp.getBody().get("id").asText()).isNotBlank();

        // ─── 2. Login ───────────────────────────────────────────────────
        Map<String, String> loginBody = Map.of(
                "username", username,
                "password", password);

        ResponseEntity<JsonNode> loginResp = http.postForEntity(
                url("/api/v1/auth"), loginBody, JsonNode.class);

        assertThat(loginResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        JsonNode tokens = loginResp.getBody();
        String accessToken  = tokens.get("accessToken").asText();
        String refreshToken = tokens.get("refreshToken").asText();

        assertThat(accessToken).isNotBlank().startsWith("eyJ");            // real JWT
        assertThat(refreshToken).isNotBlank();
        assertThat(tokens.get("tokenType").asText()).isEqualTo("Bearer");
        assertThat(tokens.get("expiresIn").asLong()).isPositive();

        // ─── 3. Use access token to call a protected endpoint ───────────
        HttpHeaders authHeaders = new HttpHeaders();
        authHeaders.setBearerAuth(accessToken);

        ResponseEntity<JsonNode> meResp = http.exchange(
                url("/api/v1/user"),
                HttpMethod.GET,
                new HttpEntity<>(authHeaders),
                JsonNode.class);

        assertThat(meResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(meResp.getBody().get("username").asText()).isEqualTo(username);

        // ─── 4. Refresh the token pair ──────────────────────────────────
        Map<String, String> refreshBody = Map.of("refreshToken", refreshToken);

        ResponseEntity<JsonNode> refreshResp = http.postForEntity(
                url("/api/v1/auth/refresh"), refreshBody, JsonNode.class);

        assertThat(refreshResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        String rotatedRefresh = refreshResp.getBody().get("refreshToken").asText();
        assertThat(rotatedRefresh).isNotBlank().isNotEqualTo(refreshToken);

        // ─── 5. Logout (revoke the rotated refresh token) ───────────────
        Map<String, String> logoutBody = Map.of("refreshToken", rotatedRefresh);

        ResponseEntity<Void> logoutResp = http.postForEntity(
                url("/api/v1/auth/logout"), logoutBody, Void.class);

        assertThat(logoutResp.getStatusCode().is2xxSuccessful()).isTrue();
    }

    @Test
    void register_returnsConflict_whenUsernameAlreadyTaken() {
        // Arrange — register once, then try again with the same username
        String username = "duplicate_" + UUID.randomUUID().toString().substring(0, 8);
        Map<String, String> body = Map.of(
                "username", username,
                "email", username + "@example.com",
                "confirmEmail", username + "@example.com",
                "password", "secret12345");

        http.postForEntity(url("/api/v1/auth/register"), body, JsonNode.class);

        // Act — second registration with a fresh email but the same username
        Map<String, String> duplicate = Map.of(
                "username", username,
                "email", "other_" + username + "@example.com",
                "confirmEmail", "other_" + username + "@example.com",
                "password", "differentpass");

        ResponseEntity<JsonNode> resp = http.postForEntity(
                url("/api/v1/auth/register"), duplicate, JsonNode.class);

        // Assert
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(resp.getBody().get("title").asText()).isEqualTo("username_taken");
    }

    @Test
    void login_returns401_whenCredentialsInvalid() {
        // Act — login with a username that doesn't exist
        Map<String, String> body = Map.of(
                "username", "ghost_" + UUID.randomUUID(),
                "password", "anyPassword123");

        ResponseEntity<JsonNode> resp = http.postForEntity(
                url("/api/v1/auth"), body, JsonNode.class);

        // Assert
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
