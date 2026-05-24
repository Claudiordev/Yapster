package com.claudiordese.comms.application.service;

import com.claudiordese.comms.application.domain.Conversation;
import com.claudiordese.comms.application.domain.MessageStatus;
import com.claudiordese.comms.application.service.commands.SendMessageCommand;
import com.claudiordese.comms.application.service.result.MessageResult;
import com.claudiordese.comms.support.FakeMessageProviderGateway;
import com.claudiordese.comms.support.InMemoryMessageStore;
import com.claudiordese.exceptions.ServiceUnavailableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.Trigger;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.ScheduledFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CommsServiceTest {

    private static final String SENDER = "alice";
    private static final Instant FIXED = Instant.parse("2026-01-01T12:00:00Z");

    private InMemoryMessageStore store;
    private FakeMessageProviderGateway provider;
    private CommsService service;

    @BeforeEach
    void setUp() {
        store = new InMemoryMessageStore();
        provider = new FakeMessageProviderGateway();

        // Immediate scheduler — runs the delayed task synchronously so the test
        // doesn't have to wait `comms.audit.fetch-delay` real-world seconds.
        TaskScheduler immediate = new ImmediateTaskScheduler();

        MessageLogger messageLogger = new MessageLogger(
                store, provider, immediate, Duration.ZERO);

        service = new CommsService(provider, store, messageLogger,
                Clock.fixed(FIXED, ZoneOffset.UTC));
    }

    @Test
    void send_persistsQueuedMessage_withProviderFetchedStatus_whenSendSucceeds() {
        // Arrange — provider accepts, and later fetch reports "delivered"
        provider.respondWith(new MessageResult("SM-abc-123", "queued", "0.0075", "USD"));
        provider.respondToFetchWith("SM-abc-123",
                new MessageResult("SM-abc-123", "delivered", "0.0075", "USD"));

        // Act
        MessageResult result = service.send(
                new SendMessageCommand(SENDER, "+46700000000", "Hello world"));

        // Assert — the response surfaces the *immediate* provider state
        assertThat(result.providerId()).isEqualTo("SM-abc-123");
        assertThat(result.status()).isEqualTo("queued");

        // …and the persisted audit row reflects the *fetched* status
        assertThat(store.all()).singleElement().satisfies(saved -> {
            assertThat(saved.status()).isEqualTo(MessageStatus.QUEUED);
            assertThat(saved.sender()).isEqualTo(SENDER);
            assertThat(saved.receiver()).isEqualTo("+46700000000");
            assertThat(saved.body()).isEqualTo("Hello world");
            assertThat(saved.providerId()).contains("SM-abc-123");
            assertThat(saved.errorMessage()).isEmpty();
            assertThat(saved.createdAt()).isEqualTo(FIXED);
        });
    }

    @Test
    void send_persistsFailedMessage_whenProviderThrows() {
        provider.throwOnSend(new ServiceUnavailableException(
                "provider_unavailable",
                "Unable to deliver message right now. Please try again later."));

        assertThatThrownBy(() -> service.send(
                new SendMessageCommand(SENDER, "+46712345600", "Hi")))
                .isInstanceOf(ServiceUnavailableException.class);

        assertThat(store.all()).singleElement().satisfies(saved -> {
            assertThat(saved.status()).isEqualTo(MessageStatus.FAILED);
            assertThat(saved.providerId()).isEmpty();
            assertThat(saved.errorMessage()).hasValueSatisfying(msg ->
                    assertThat(msg).contains("Unable to deliver"));
        });
    }

    @Test
    void conversationsFor_groupsBySenderAndOrdersByFirstContact() {
        // Arrange — alice sends to bob, then carol, then bob again
        provider.respondWith(new MessageResult("SM-1", "queued", "0.01", "USD"));
        provider.respondToFetchWith("SM-1", new MessageResult("SM-1", "delivered", "0.01", "USD"));
        service.send(new SendMessageCommand(SENDER, "+46700000001", "hey bob"));

        provider.respondWith(new MessageResult("SM-2", "queued", "0.01", "USD"));
        provider.respondToFetchWith("SM-2", new MessageResult("SM-2", "delivered", "0.01", "USD"));
        service.send(new SendMessageCommand(SENDER, "+46700000002", "hey carol"));

        provider.respondWith(new MessageResult("SM-3", "queued", "0.01", "USD"));
        provider.respondToFetchWith("SM-3", new MessageResult("SM-3", "delivered", "0.01", "USD"));
        service.send(new SendMessageCommand(SENDER, "+46700000001", "bob again"));

        // Act
        List<Conversation> conversations = service.conversationsFor(SENDER);

        // Assert — two conversations, bob first (alphabetically by first contact)
        assertThat(conversations).hasSize(2);
        assertThat(conversations.get(0).receiver()).isEqualTo("+46700000001");
        assertThat(conversations.get(0).messages()).extracting("body")
                .containsExactly("hey bob", "bob again");
        assertThat(conversations.get(1).receiver()).isEqualTo("+46700000002");
        assertThat(conversations.get(1).messages()).extracting("body")
                .containsExactly("hey carol");
    }

    /** A {@link TaskScheduler} that runs every submitted task synchronously. */
    private static final class ImmediateTaskScheduler implements TaskScheduler {

        @Override
        public ScheduledFuture<?> schedule(Runnable task, Instant startTime) {
            task.run();
            return null;
        }

        @Override
        public ScheduledFuture<?> schedule(Runnable task, Trigger trigger) {
            throw new UnsupportedOperationException("trigger-based not used");
        }

        @Override
        public ScheduledFuture<?> scheduleAtFixedRate(Runnable task, Instant startTime, Duration period) {
            throw new UnsupportedOperationException("fixed-rate not used");
        }

        @Override
        public ScheduledFuture<?> scheduleAtFixedRate(Runnable task, Duration period) {
            throw new UnsupportedOperationException("fixed-rate not used");
        }

        @Override
        public ScheduledFuture<?> scheduleWithFixedDelay(Runnable task, Instant startTime, Duration delay) {
            throw new UnsupportedOperationException("fixed-delay not used");
        }

        @Override
        public ScheduledFuture<?> scheduleWithFixedDelay(Runnable task, Duration delay) {
            throw new UnsupportedOperationException("fixed-delay not used");
        }
    }
}
