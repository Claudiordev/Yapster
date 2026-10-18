package com.claudiordese.chat.infrastructure.adapter.socket;

import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.application.domain.event.server.RolesChangedEvent;
import com.claudiordese.chat.infrastructure.configuration.SocketClusterProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Two chat replicas sharing one real Redis. */
@Testcontainers(disabledWithoutDocker = true)
class RedisSocketClusterIT {

    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    private static LettuceConnectionFactory connectionFactory;
    private static StringRedisTemplate redis;
    private static RedisMessageListenerContainer listeners;

    private final ObjectMapper json = new ObjectMapper();
    private final MutableClock clock = new MutableClock();
    private SocketClusterProperties properties;
    private RedisSocketRegistry registry;

    @BeforeAll
    static void connect() {
        connectionFactory = new LettuceConnectionFactory(REDIS.getHost(), REDIS.getMappedPort(6379));
        connectionFactory.afterPropertiesSet();
        redis = new StringRedisTemplate(connectionFactory);
        redis.afterPropertiesSet();
        listeners = new RedisMessageListenerContainer();
        listeners.setConnectionFactory(connectionFactory);
        listeners.afterPropertiesSet();
        listeners.start();
    }

    @AfterAll
    static void disconnect() throws Exception {
        listeners.destroy();
        connectionFactory.destroy();
    }

    @BeforeEach
    void setUp() {
        redis.getConnectionFactory().getConnection().serverCommands().flushAll();
        //A prefix per test keeps pub/sub subscriptions of earlier tests from interfering
        properties = new SocketClusterProperties("", Duration.ofSeconds(30), Duration.ofSeconds(10), "it" + UUID.randomUUID());
        registry = new RedisSocketRegistry(redis, properties, clock);
    }

    @Test
    void registry_countsConnectionsPerUserAndGlobally() {
        // Arrange
        registry.add("alice", "n1:a");
        registry.add("alice", "n2:b");
        registry.add("bob", "n2:c");

        // Assert
        assertThat(registry.connectionCount("alice")).isEqualTo(2);
        assertThat(registry.connectionCount("bob")).isEqualTo(1);
        assertThat(registry.connectionCount("carol")).isZero();
        assertThat(registry.onlineUsers()).isEqualTo(2);
        assertThat(registry.onlineDevices()).isEqualTo(3);
    }

    @Test
    void registry_remove_dropsOnlyThatConnection() {
        // Arrange
        registry.add("alice", "n1:a");
        registry.add("alice", "n2:b");

        // Act
        registry.remove("alice", "n1:a");

        // Assert
        assertThat(registry.connectionCount("alice")).isEqualTo(1);
        assertThat(registry.onlineDevices()).isEqualTo(1);
    }

    @Test
    void registry_forgetsConnectionsNobodyRefreshed() {
        // Arrange
        registry.add("alice", "n1:a");
        registry.add("bob", "n1:b");

        // Act - a replica died, so only bob is refreshed (by another replica) after the ttl
        clock.advance(Duration.ofSeconds(31));
        registry.refresh(Map.of("bob", Set.of("n1:b")));

        // Assert
        assertThat(registry.connectionCount("alice")).isZero();
        assertThat(registry.connectionCount("bob")).isEqualTo(1);
        assertThat(registry.onlineUsers()).isEqualTo(1);
        assertThat(registry.onlineDevices()).isEqualTo(1);
    }

    @Test
    void registry_ignoresExpiredConnectionsEvenBeforeAnyCleanup() {
        // Arrange
        registry.add("alice", "n1:a");

        // Act
        clock.advance(Duration.ofSeconds(31));

        // Assert
        assertThat(registry.connectionCount("alice")).isZero();
        assertThat(registry.onlineUsers()).isZero();
        assertThat(registry.onlineDevices()).isZero();
    }

    @Test
    void registry_refresh_extendsTheLifetime() {
        // Arrange
        registry.add("alice", "n1:a");
        clock.advance(Duration.ofSeconds(20));

        // Act
        registry.refresh(Map.of("alice", Set.of("n1:a")));
        clock.advance(Duration.ofSeconds(20));

        // Assert
        assertThat(registry.connectionCount("alice")).isEqualTo(1);
    }

    @Test
    void registry_status_roundTrips_andReportsChanges() {
        // Assert
        assertThat(registry.status("alice")).isEmpty();
        assertThat(registry.putStatus("alice", UserStatusType.BUSY)).isTrue();
        assertThat(registry.putStatus("alice", UserStatusType.BUSY)).isFalse();
        assertThat(registry.status("alice")).contains(UserStatusType.BUSY);

        // Act
        registry.clearStatus("alice");

        // Assert
        assertThat(registry.status("alice")).isEmpty();
    }

    @Test
    void event_sentOnOneReplica_reachesSocketOnTheOther() throws Exception {
        // Arrange
        WebSocketEventGateway nodeA = replica("node-a");
        WebSocketEventGateway nodeB = replica("node-b");
        WebSocketSession aliceOnB = socket("b1");
        nodeB.register("alice", aliceOnB);

        // Act
        nodeA.send("alice", new RolesChangedEvent());

        // Assert
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> verify(aliceOnB).sendMessage(any(TextMessage.class)));
        assertThat(nodeA.isOnline("alice")).isTrue();
    }

    @Test
    void event_isDeliveredOncePerSocket_whenUserIsOnBothReplicas() throws Exception {
        // Arrange
        WebSocketEventGateway nodeA = replica("node-a");
        WebSocketEventGateway nodeB = replica("node-b");
        WebSocketSession aliceOnA = socket("a1");
        WebSocketSession aliceOnB = socket("b1");
        nodeA.register("alice", aliceOnA);
        nodeB.register("alice", aliceOnB);

        // Act
        nodeA.send("alice", new RolesChangedEvent());

        // Assert
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> verify(aliceOnB).sendMessage(any(TextMessage.class)));
        verify(aliceOnA).sendMessage(any(TextMessage.class));
        //Let a would-be duplicate arrive, then check there is still only one frame each
        Thread.sleep(300);
        verify(aliceOnA, org.mockito.Mockito.times(1)).sendMessage(any(TextMessage.class));
        verify(aliceOnB, org.mockito.Mockito.times(1)).sendMessage(any(TextMessage.class));
    }

    private WebSocketEventGateway replica(String nodeId) {
        SocketClusterProperties own = new SocketClusterProperties(nodeId, properties.connectionTtl(), properties.heartbeatInterval(), properties.keyPrefix());
        WebSocketEventGateway gateway = new WebSocketEventGateway(json, Runnable::run, registry,
                new RedisClusterEventPublisher(redis, json, own), own);
        listeners.addMessageListener(new RedisClusterEventSubscriber(json, gateway), new ChannelTopic(own.channel()));
        return gateway;
    }

    private static WebSocketSession socket(String id) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        return session;
    }

    private static final class MutableClock extends Clock {

        private final AtomicReference<Instant> now = new AtomicReference<>(Instant.now());

        void advance(Duration duration) {
            now.updateAndGet(i -> i.plus(duration));
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now.get();
        }
    }
}
