package com.claudiordese.chat.integration;

import com.fasterxml.jackson.databind.JsonNode;
import io.jsonwebtoken.Jwts;
import jakarta.persistence.EntityManagerFactory;
import io.jsonwebtoken.SignatureAlgorithm;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Reactions end to end over HTTP: the real controller, security filter, service, JPA mapping and the
 * Flyway migrations, against a real Postgres and Redis in Testcontainers. Hibernate runs with
 * {@code ddl-auto=validate}, so the entities are checked against the migrated schema too.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class ReactionFlowIT {

    private static final String THUMBS_UP = "1f44d";
    private static final String HEART = "2764-fe0f";
    private static final String SMILE = "1f600";

    private static final KeyPair KEYS = generateKeys();

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("chat_test")
            .withUsername("test")
            .withPassword("test");

    // Rate limiting (and presence) go through Redis.
    @Container
    static final GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void overrideProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("spring.jpa.properties.hibernate.generate_statistics", () -> "true");

        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));

        // application.properties is not committed, so everything the context needs is set here.
        registry.add("spring.application.name", () -> "chat");
        registry.add("url.api.base-path", () -> "/api/v1");
        registry.add("internal.secret", () -> "test-secret");
        registry.add("security.jwt.public-key-path", () -> "keys/test-public.pem");
        registry.add("security.jwt.authenticated-paths[0]", () -> "/api/v1/chat/**");
        registry.add("security.jwt.additional-public-paths[0]", () -> "/ws");
        registry.add("eureka.client.enabled", () -> "false");
        registry.add("spring.cloud.discovery.enabled", () -> "false");
        registry.add("management.tracing.sampling.probability", () -> "0");

        // Small cap so the distinct-emoji limit is cheap to reach.
        registry.add("reaction.max-distinct", () -> "2");
    }

    @LocalServerPort int port;

    @Autowired TestRestTemplate http;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManagerFactory entityManagerFactory;

    @Test
    void put_addsTheReaction_andRepeatingItChangesNothing() {
        Chat chat = chat();

        assertThat(put(chat, chat.alice, chat.messageId, THUMBS_UP).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(put(chat, chat.alice, chat.messageId, THUMBS_UP).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        assertThat(reactionsOf(chat.messageId)).containsExactly(chat.alice + " " + THUMBS_UP);
    }

    @Test
    void sameEmojiFromTwoUsers_isTwoReactions() {
        Chat chat = chat();

        put(chat, chat.alice, chat.messageId, THUMBS_UP);
        put(chat, chat.bob, chat.messageId, THUMBS_UP);

        assertThat(reactionsOf(chat.messageId))
                .containsExactlyInAnyOrder(chat.alice + " " + THUMBS_UP, chat.bob + " " + THUMBS_UP);
    }

    @Test
    void delete_removesOnlyTheCallersReaction_andRepeatingItIsFine() {
        Chat chat = chat();
        put(chat, chat.alice, chat.messageId, THUMBS_UP);
        put(chat, chat.bob, chat.messageId, THUMBS_UP);

        assertThat(delete(chat, chat.alice, chat.messageId, THUMBS_UP).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(delete(chat, chat.alice, chat.messageId, THUMBS_UP).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        assertThat(reactionsOf(chat.messageId)).containsExactly(chat.bob + " " + THUMBS_UP);
    }

    @Test
    void deletingTheMessage_cascadesToItsReactions() {
        Chat chat = chat();
        put(chat, chat.alice, chat.messageId, THUMBS_UP);
        put(chat, chat.bob, chat.messageId, HEART);

        jdbc.update("DELETE FROM message WHERE id = ?", UUID.fromString(chat.messageId));

        assertThat(reactionsOf(chat.messageId)).isEmpty();
    }

    @Test
    void composedEmoji_isStoredAsItsHexKey() {
        Chat chat = chat();
        String family = "1f468-200d-1f469-200d-1f467-200d-1f466";

        assertThat(put(chat, chat.alice, chat.messageId, family).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        assertThat(reactionsOf(chat.messageId)).containsExactly(chat.alice + " " + family);
    }

    @Test
    void aThirdDifferentEmoji_isRefused_butJoiningAnExistingOneIsNot() {
        Chat chat = chat();
        put(chat, chat.alice, chat.messageId, THUMBS_UP);
        put(chat, chat.alice, chat.messageId, HEART);

        ResponseEntity<JsonNode> refused = put(chat, chat.alice, chat.messageId, SMILE);
        ResponseEntity<JsonNode> joined = put(chat, chat.bob, chat.messageId, HEART);

        assertThat(refused.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(refused.getBody().get("code").asText()).isEqualTo("too_many_reactions");
        assertThat(joined.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(reactionsOf(chat.messageId)).hasSize(3);
    }

    @Test
    void anythingButACanonicalSingleEmojiKey_isABadRequest() {
        Chat chat = chat();

        for (String emoji : List.of("zzzz", "1F44D", "0031", "1f44d-1f44d")) {
            ResponseEntity<JsonNode> response = put(chat, chat.alice, chat.messageId, emoji);

            assertThat(response.getStatusCode()).as(emoji).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody().get("code").asText()).as(emoji).isEqualTo("invalid_emoji");
        }

        assertThat(reactionsOf(chat.messageId)).isEmpty();
    }

    @Test
    void aStranger_isForbidden_andAnUnknownOrForeignMessage_isNotFound() {
        Chat chat = chat();
        Chat otherChat = chat();
        String stranger = UUID.randomUUID().toString();

        ResponseEntity<JsonNode> notMember = put(chat, stranger, chat.messageId, THUMBS_UP);
        ResponseEntity<JsonNode> unknown = put(chat, chat.alice, UUID.randomUUID().toString(), THUMBS_UP);
        ResponseEntity<JsonNode> foreign = put(chat, chat.alice, otherChat.messageId, THUMBS_UP);

        assertThat(notMember.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(notMember.getBody().get("code").asText()).isEqualTo("not_a_member");
        assertThat(unknown.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(foreign.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(foreign.getBody().get("code").asText()).isEqualTo("message_not_found");
    }

    @Test
    void aSystemMessage_cannotBeReactedTo() {
        Chat chat = chat();
        UUID systemMessageId = UUID.randomUUID();
        jdbc.update("INSERT INTO message (id, conversation_id, sender_id, body, sent_at, type, system_event, subject_id) "
                        + "VALUES (?, ?, NULL, '', now(), 'SYSTEM', 'MEMBER_ADDED', ?)",
                systemMessageId, UUID.fromString(chat.conversationId), UUID.fromString(chat.bob));

        ResponseEntity<JsonNode> response = put(chat, chat.alice, systemMessageId.toString(), THUMBS_UP);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("system_message");
    }

    @Test
    void withoutAToken_theEndpointIsNotReachable() {
        Chat chat = chat();

        ResponseEntity<String> response = http.exchange(
                url(chat, chat.messageId, THUMBS_UP), HttpMethod.PUT, new HttpEntity<>(new HttpHeaders()), String.class);

        assertThat(response.getStatusCode()).isIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
        assertThat(reactionsOf(chat.messageId)).isEmpty();
    }

    @Test
    void aUserIsLimitedToTwentyReactionActionsPerConversation() {
        Chat chat = chat();

        // Adding and removing share one budget.
        for (int i = 0; i < 10; i++) {
            assertThat(put(chat, chat.alice, chat.messageId, THUMBS_UP).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
            assertThat(delete(chat, chat.alice, chat.messageId, THUMBS_UP).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        }

        ResponseEntity<JsonNode> limited = put(chat, chat.alice, chat.messageId, THUMBS_UP);

        assertThat(limited.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(limited.getBody().get("code").asText()).isEqualTo("reaction_rate_limit_exceeded");
        // Someone else in the same conversation is not affected.
        assertThat(put(chat, chat.bob, chat.messageId, THUMBS_UP).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void history_returnsEachMessageWithItsReactionsGrouped_oldestReactionFirst() {
        Chat chat = chat();
        String second = send(chat, "second");
        put(chat, chat.alice, chat.messageId, THUMBS_UP);
        put(chat, chat.bob, chat.messageId, THUMBS_UP);
        put(chat, chat.alice, chat.messageId, HEART);

        JsonNode page = history(chat, chat.bob, 20);

        // Newest message first, and it has no reactions.
        assertThat(page.get(0).get("id").asText()).isEqualTo(second);
        assertThat(page.get(0).get("reactions").size()).isZero();

        JsonNode reactions = page.get(1).get("reactions");
        assertThat(reactions.size()).isEqualTo(2);
        assertThat(reactions.get(0).get("emoji").asText()).isEqualTo(THUMBS_UP);
        assertThat(reactions.get(0).get("count").asInt()).isEqualTo(2);
        assertThat(texts(reactions.get(0).get("userIds"))).containsExactly(chat.alice, chat.bob);
        assertThat(reactions.get(1).get("emoji").asText()).isEqualTo(HEART);
        assertThat(reactions.get(1).get("count").asInt()).isEqualTo(1);
        assertThat(texts(reactions.get(1).get("userIds"))).containsExactly(chat.alice);
    }

    @Test
    void history_noLongerShowsARemovedReaction() {
        Chat chat = chat();
        put(chat, chat.alice, chat.messageId, THUMBS_UP);
        put(chat, chat.bob, chat.messageId, THUMBS_UP);
        delete(chat, chat.alice, chat.messageId, THUMBS_UP);

        JsonNode reactions = history(chat, chat.alice, 20).get(0).get("reactions");

        assertThat(reactions.size()).isEqualTo(1);
        assertThat(reactions.get(0).get("count").asInt()).isEqualTo(1);
        assertThat(texts(reactions.get(0).get("userIds"))).containsExactly(chat.bob);
    }

    @Test
    void history_loadsReactionsWithTheSameNumberOfStatements_whateverThePageSize() {
        Chat chat = chat();
        put(chat, chat.alice, chat.messageId, THUMBS_UP);
        put(chat, chat.bob, chat.messageId, THUMBS_UP);

        for (int i = 0; i < 5; i++) {
            String messageId = send(chat, "message " + i);
            put(chat, chat.alice, messageId, THUMBS_UP);
            put(chat, chat.bob, messageId, HEART);
        }

        history(chat, chat.alice, 20); // warm-up, so one-off start-up queries are not counted
        long forOneMessage = statementsForHistory(chat, 1);
        long forSixMessages = statementsForHistory(chat, 20);

        assertThat(forOneMessage).isPositive();
        assertThat(forSixMessages).isEqualTo(forOneMessage);
        assertThat(history(chat, chat.alice, 20).size()).isEqualTo(6);
    }

    // ─── helpers ────────────────────────────────────────────────────────

    private long statementsForHistory(Chat chat, int limit) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        history(chat, chat.alice, limit);

        return statistics.getPrepareStatementCount();
    }

    /** Newest first, as the endpoint returns it. */
    private JsonNode history(Chat chat, String userId, int limit) {
        return http.exchange(url("/api/v1/chat/" + chat.conversationId + "/message?limit=" + limit),
                HttpMethod.GET, new HttpEntity<>(headers(userId)), JsonNode.class).getBody();
    }

    private String send(Chat chat, String body) {
        return http.exchange(url("/api/v1/chat/" + chat.conversationId + "/message"), HttpMethod.POST,
                new HttpEntity<>(Map.of("body", body), headers(chat.alice)), JsonNode.class).getBody().get("id").asText();
    }

    private static List<String> texts(JsonNode array) {
        return StreamSupport.stream(array.spliterator(), false).map(JsonNode::asText).toList();
    }

    /** A DM between two fresh users with one message from alice, created through the real endpoints. */
    private Chat chat() {
        String alice = UUID.randomUUID().toString();
        String bob = UUID.randomUUID().toString();

        JsonNode dm = http.exchange(url("/api/v1/chat/dm"), HttpMethod.POST,
                new HttpEntity<>(Map.of("recipientUserId", bob), headers(alice)), JsonNode.class).getBody();
        String conversationId = dm.get("id").asText();

        JsonNode message = http.exchange(url("/api/v1/chat/" + conversationId + "/message"), HttpMethod.POST,
                new HttpEntity<>(Map.of("body", "hello"), headers(alice)), JsonNode.class).getBody();

        return new Chat(conversationId, message.get("id").asText(), alice, bob);
    }

    private ResponseEntity<JsonNode> put(Chat chat, String userId, String messageId, String emoji) {
        return http.exchange(url(chat, messageId, emoji), HttpMethod.PUT,
                new HttpEntity<>(headers(userId)), JsonNode.class);
    }

    private ResponseEntity<JsonNode> delete(Chat chat, String userId, String messageId, String emoji) {
        return http.exchange(url(chat, messageId, emoji), HttpMethod.DELETE,
                new HttpEntity<>(headers(userId)), JsonNode.class);
    }

    /** "userId emoji" rows, straight from the table. */
    private List<String> reactionsOf(String messageId) {
        return jdbc.query("SELECT user_id, emoji FROM message_reaction WHERE message_id = ?",
                (rs, row) -> rs.getString("user_id") + " " + rs.getString("emoji"),
                UUID.fromString(messageId));
    }

    private String url(Chat chat, String messageId, String emoji) {
        return url("/api/v1/chat/" + chat.conversationId + "/message/" + messageId + "/reaction/" + emoji);
    }

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    private static HttpHeaders headers(String userId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(Jwts.builder()
                .setSubject(userId)
                .claim("roles", List.of("USER"))
                .signWith(KEYS.getPrivate(), SignatureAlgorithm.RS256)
                .compact());
        return headers;
    }

    private record Chat(String conversationId, String messageId, String alice, String bob) {}

    /**
     * The service only knows a public key, loaded from the classpath. A throwaway pair is generated per run
     * and its public half is written into the test classpath, so no private key is ever committed.
     */
    private static KeyPair generateKeys() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            KeyPair keys = generator.generateKeyPair();

            Path keysDir = Path.of(Objects.requireNonNull(ReactionFlowIT.class.getResource("/")).toURI()).resolve("keys");
            Files.createDirectories(keysDir);
            Files.writeString(keysDir.resolve("test-public.pem"),
                    "-----BEGIN PUBLIC KEY-----\n"
                            + Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(keys.getPublic().getEncoded())
                            + "\n-----END PUBLIC KEY-----\n");

            return keys;
        } catch (Exception e) {
            throw new IllegalStateException("Could not prepare the JWT test keys", e);
        }
    }
}
