package com.claudiordese.comms.application.service;

import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.domain.MessageStatus;
import com.claudiordese.comms.application.port.BalanceGateway;
import com.claudiordese.comms.application.port.CommsEventPublisher;
import com.claudiordese.comms.application.port.MessageProviderGateway;
import com.claudiordese.comms.application.port.MessageStore;
import com.claudiordese.comms.application.port.ProviderSendResult;
import com.claudiordese.comms.application.service.commands.GetMessageCommand;
import com.claudiordese.comms.application.service.commands.SendMessageCommand;
import com.claudiordese.comms.application.service.result.MessageResult;
import com.claudiordese.comms.support.FakeMessageProviderGateway;
import com.claudiordese.comms.support.InMemoryBalanceGateway;
import com.claudiordese.comms.support.InMemoryMessageStore;
import com.claudiordese.comms.support.RecordingCommsEventPublisher;
import com.claudiordese.exceptions.InterdictedException;
import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.exceptions.NotFound;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CommsServiceTest {

    private static final String USER = "alice";
    private static final Instant FIXED = Instant.parse("2026-01-01T12:00:00Z");

    private MessageStore messages;
    private MessageProviderGateway provider;
    private BalanceGateway balances;
    private CommsEventPublisher events;
    private CommsService service;

    @BeforeEach
    void setUp() {
        messages = new InMemoryMessageStore();
        provider = new FakeMessageProviderGateway();
        balances = new InMemoryBalanceGateway().set(USER, new BigDecimal("100.00"));
        events = new RecordingCommsEventPublisher();
        service = new CommsService(messages, provider, balances, events,
                Clock.fixed(FIXED, ZoneOffset.UTC));
    }

    @Test
    void send_persistsAndReturnsSent_whenProviderAccepts() {
        // Arrange
        ((FakeMessageProviderGateway) provider).respondWith(
                new ProviderSendResult("SM-abc-123", "0.0075", "USD", "queued"));

        // Act
        MessageResult result = service.send(new SendMessageCommand(USER, "+46700000000", "Hello world"));

        // Assert
        assertThat(result.providerId()).isEqualTo("SM-abc-123");
        assertThat(result.status()).isEqualTo(MessageStatus.SENT);
        assertThat(result.priceUnit()).isEqualTo("USD");
        assertThat(result.sender()).isEqualTo(USER);

        Message saved = messages.findById(result.id()).orElseThrow();
        assertThat(saved.status()).isEqualTo(MessageStatus.SENT);
        assertThat(saved.providerId()).contains("SM-abc-123");

        assertThat(((InMemoryMessageStore) messages).saveCalls()).isEqualTo(2);

        var publisher = (RecordingCommsEventPublisher) events;
        assertThat(publisher.events())
                .extracting(RecordingCommsEventPublisher.Event::status)
                .containsExactly(MessageStatus.QUEUED, MessageStatus.SENT);
    }

    @Test
    void send_marksFailed_whenProviderRejectsCredentials() {
        // Arrange
        ((FakeMessageProviderGateway) provider).throwOnSend(
                new InvalidAuthorizationException("401", "No permission"));

        // Act + Assert
        assertThatThrownBy(() -> service.send(new SendMessageCommand(USER, "+46712345600", "Hello world")))
                .isInstanceOf(InvalidAuthorizationException.class);

        assertThat(((InMemoryMessageStore) messages).saveCalls()).isEqualTo(2);

        var publisher = (RecordingCommsEventPublisher) events;
        assertThat(publisher.events())
                .extracting(RecordingCommsEventPublisher.Event::status)
                .containsExactly(MessageStatus.QUEUED, MessageStatus.FAILED);
    }

    @Test
    void send_throwsInterdicted_whenBalanceIsZero() {
        // Arrange
        balances = new InMemoryBalanceGateway().set(USER, BigDecimal.ZERO);
        service = new CommsService(messages, provider, balances, events,
                Clock.fixed(FIXED, ZoneOffset.UTC));

        // Act + Assert
        assertThatThrownBy(() -> service.send(new SendMessageCommand(USER, "+46700000000", "Hello world")))
                .isInstanceOf(InterdictedException.class);

        assertThat(((InMemoryMessageStore) messages).saveCalls()).isZero();
        assertThat(((FakeMessageProviderGateway) provider).calls()).isEmpty();
    }

    @Test
    void get_returnsMessage_whenRequesterIsSender() {
        // Arrange
        MessageResult sent = service.send(new SendMessageCommand(USER, "+46700000000", "Hello world"));

        // Act
        MessageResult fetched = service.get(new GetMessageCommand(sent.id(), USER));

        // Assert
        assertThat(fetched.id()).isEqualTo(sent.id());
        assertThat(fetched.body()).isEqualTo("Hello world");
    }

    @Test
    void get_throwsInterdicted_whenRequesterIsNotSender() {
        // Arrange
        MessageResult sent = service.send(new SendMessageCommand(USER, "+46700000000", "Hello world"));

        // Act + Assert
        assertThatThrownBy(() -> service.get(new GetMessageCommand(sent.id(), "mallory")))
                .isInstanceOf(InterdictedException.class);
    }

    @Test
    void get_throwsNotFound_whenMessageDoesNotExist() {
        assertThatThrownBy(() -> service.get(new GetMessageCommand(UUID.randomUUID(), USER)))
                .isInstanceOf(NotFound.class);
    }
}
