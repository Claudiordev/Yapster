package com.claudiordese.chat.infrastructure.adapter.socket;

import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.application.domain.event.server.RolesChangedEvent;
import com.claudiordese.chat.infrastructure.configuration.SocketClusterProperties;
import com.claudiordese.chat.support.InMemorySocketRegistry;
import com.claudiordese.chat.support.LoopbackClusterBus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WebSocketEventGatewayTest {

    private static final String ALICE = "alice-id";
    private static final String BOB = "bob-id";

    private InMemorySocketRegistry registry;
    private LoopbackClusterBus bus;
    private WebSocketEventGateway nodeA;
    private WebSocketEventGateway nodeB;

    @BeforeEach
    void setUp() {
        registry = new InMemorySocketRegistry();
        bus = new LoopbackClusterBus();
        nodeA = newNode("node-a");
        nodeB = newNode("node-b");
    }

    @Test
    void send_reachesSocketsOnAnotherReplica() throws Exception {
        // Arrange
        WebSocketSession aliceOnB = socket("a1");
        nodeB.register(ALICE, aliceOnB);

        // Act - the event originates on replica A, where Alice has no socket
        nodeA.send(ALICE, new RolesChangedEvent());

        // Assert
        verify(aliceOnB).sendMessage(any(TextMessage.class));
    }

    @Test
    void send_reachesSocketsOnEveryReplicaExactlyOnce() throws Exception {
        // Arrange
        WebSocketSession aliceOnA = socket("a1");
        WebSocketSession aliceOnB = socket("b1");
        nodeA.register(ALICE, aliceOnA);
        nodeB.register(ALICE, aliceOnB);

        // Act
        nodeA.send(ALICE, new RolesChangedEvent());

        // Assert
        verify(aliceOnA, times(1)).sendMessage(any(TextMessage.class));
        verify(aliceOnB, times(1)).sendMessage(any(TextMessage.class));
    }

    @Test
    void send_doesNotPublish_whenAllSocketsAreLocal() {
        // Arrange
        nodeA.register(ALICE, socket("a1"));

        // Act
        nodeA.send(ALICE, new RolesChangedEvent());

        // Assert
        assertThat(bus.published()).isEmpty();
    }

    @Test
    void send_doesNothing_whenUserIsOfflineEverywhere() {
        // Act
        nodeA.send(ALICE, new RolesChangedEvent());

        // Assert
        assertThat(bus.published()).isEmpty();
    }

    @Test
    void send_carriesTheSameFrameToOtherReplicas() throws Exception {
        // Arrange
        WebSocketSession aliceOnB = socket("b1");
        nodeB.register(ALICE, aliceOnB);

        // Act
        nodeA.send(ALICE, new RolesChangedEvent());

        // Assert
        assertThat(bus.published()).singleElement().satisfies(envelope -> {
            assertThat(envelope.origin()).isEqualTo("node-a");
            assertThat(envelope.userId()).isEqualTo(ALICE);
            assertThat(envelope.payload()).contains("ROLES_CHANGED");
        });
    }

    @Test
    void send_stillReachesLocalSockets_whenPublishingFails() throws Exception {
        // Arrange
        WebSocketSession aliceOnA = socket("a1");
        nodeA.register(ALICE, aliceOnA);
        nodeB.register(ALICE, socket("b1"));
        bus.setFailing(true);

        // Act
        nodeA.send(ALICE, new RolesChangedEvent());

        // Assert
        verify(aliceOnA).sendMessage(any(TextMessage.class));
    }

    @Test
    void isOnline_seesSocketsOnOtherReplicas() {
        // Arrange
        nodeB.register(ALICE, socket("b1"));

        // Assert
        assertThat(nodeA.isOnline(ALICE)).isTrue();
        assertThat(nodeA.isOnline(BOB)).isFalse();
    }

    @Test
    void isOnline_staysTrue_untilTheLastSocketOnAnyReplicaCloses() {
        // Arrange
        WebSocketSession onA = socket("a1");
        WebSocketSession onB = socket("b1");
        nodeA.register(ALICE, onA);
        nodeB.register(ALICE, onB);

        // Act
        nodeA.unregister(ALICE, onA);

        // Assert
        assertThat(nodeA.isOnline(ALICE)).isTrue();

        // Act
        nodeB.unregister(ALICE, onB);

        // Assert
        assertThat(nodeA.isOnline(ALICE)).isFalse();
        assertThat(nodeB.isOnline(ALICE)).isFalse();
    }

    @Test
    void onlineCounts_spanAllReplicas() {
        // Arrange
        nodeA.register(ALICE, socket("a1"));
        nodeA.register(ALICE, socket("a2"));
        nodeB.register(ALICE, socket("b1"));
        nodeB.register(BOB, socket("b2"));

        // Assert
        assertThat(nodeA.onlineUsers()).isEqualTo(2);
        assertThat(nodeB.onlineDevices()).isEqualTo(4);
    }

    @Test
    void status_isSharedBetweenReplicas() {
        // Arrange
        nodeA.register(ALICE, socket("a1"));

        // Act
        boolean changed = nodeA.setStatus(ALICE, UserStatusType.BUSY);

        // Assert
        assertThat(changed).isTrue();
        assertThat(nodeB.statusOf(ALICE)).isEqualTo(UserStatusType.BUSY);
        assertThat(nodeB.setStatus(ALICE, UserStatusType.BUSY)).isFalse();
    }

    @Test
    void statusOf_defaultsToOnline_andOfflineWhenNotConnected() {
        // Arrange
        nodeA.register(ALICE, socket("a1"));

        // Assert
        assertThat(nodeB.statusOf(ALICE)).isEqualTo(UserStatusType.ONLINE);
        assertThat(nodeB.statusOf(BOB)).isEqualTo(UserStatusType.OFFLINE);
        assertThat(nodeB.setStatus(BOB, UserStatusType.BUSY)).isFalse();
    }

    @Test
    void status_isForgotten_whenUserGoesOffline() {
        // Arrange
        WebSocketSession socket = socket("a1");
        nodeA.register(ALICE, socket);
        nodeA.setStatus(ALICE, UserStatusType.BUSY);

        // Act
        nodeA.unregister(ALICE, socket);
        nodeA.register(ALICE, socket("a2"));

        // Assert
        assertThat(nodeA.statusOf(ALICE)).isEqualTo(UserStatusType.ONLINE);
    }

    @Test
    void heartbeat_republishesConnections_theRegistryLost() {
        // Arrange
        nodeA.register(ALICE, socket("a1"));
        registry.expireAll();
        assertThat(nodeB.isOnline(ALICE)).isFalse();

        // Act
        nodeA.refreshRegistry();

        // Assert
        assertThat(nodeB.isOnline(ALICE)).isTrue();
    }

    @Test
    void shutdown_removesThisReplicasConnectionsOnly() {
        // Arrange
        nodeA.register(ALICE, socket("a1"));
        nodeB.register(ALICE, socket("b1"));

        // Act
        nodeA.shutdown();

        // Assert
        assertThat(registry.connectionsOf(ALICE)).hasSize(1).allMatch(id -> id.startsWith("node-b:"));
    }

    @Test
    void gateway_keepsServingLocalSockets_whenRedisIsDown() throws Exception {
        // Arrange
        WebSocketSession aliceOnA = socket("a1");
        registry.setFailing(true);

        // Act
        nodeA.register(ALICE, aliceOnA);
        nodeA.send(ALICE, new RolesChangedEvent());

        // Assert
        verify(aliceOnA).sendMessage(any(TextMessage.class));
        assertThat(nodeA.isOnline(ALICE)).isTrue();
        assertThat(nodeA.onlineUsers()).isEqualTo(1);
        assertThat(nodeA.statusOf(ALICE)).isEqualTo(UserStatusType.ONLINE);
    }

    @Test
    void deliverFromCluster_ignoresEventsPublishedByItself() throws Exception {
        // Arrange
        WebSocketSession aliceOnA = socket("a1");
        nodeA.register(ALICE, aliceOnA);

        // Act
        nodeA.deliverFromCluster(new ClusterEnvelope("node-a", ALICE, "{}"));

        // Assert
        verify(aliceOnA, never()).sendMessage(any(TextMessage.class));
    }

    private WebSocketEventGateway newNode(String nodeId) {
        SocketClusterProperties properties = new SocketClusterProperties(nodeId, Duration.ofSeconds(30), Duration.ofSeconds(10), "chat:ws");
        WebSocketEventGateway gateway = new WebSocketEventGateway(new ObjectMapper(), Runnable::run, registry, bus, properties);
        bus.subscribe(gateway);
        return gateway;
    }

    private static WebSocketSession socket(String id) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        return session;
    }
}
