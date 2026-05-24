package com.claudiordese.comms.application.service;

import com.claudiordese.comms.application.domain.Message;
import com.claudiordese.comms.application.port.BalanceGateway;
import com.claudiordese.comms.application.port.CommsEventPublisher;
import com.claudiordese.comms.application.port.MessageProviderGateway;
import com.claudiordese.comms.application.port.MessageStore;
import com.claudiordese.comms.application.port.ProviderSendResult;
import com.claudiordese.comms.application.service.commands.GetMessageCommand;
import com.claudiordese.comms.application.service.commands.SendMessageCommand;
import com.claudiordese.comms.application.service.result.MessageResult;
import com.claudiordese.exceptions.CircuitBreakerException;
import com.claudiordese.exceptions.InterdictedException;
import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.exceptions.NotFound;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
public class CommsService {

    private static final Logger logger = LoggerFactory.getLogger(CommsService.class);

    private final MessageStore messages;
    private final MessageProviderGateway provider;
    private final BalanceGateway balances;
    private final CommsEventPublisher events;
    private final Clock clock;

    public CommsService(MessageStore messages,
                        MessageProviderGateway provider,
                        BalanceGateway balances,
                        CommsEventPublisher events,
                        Clock clock) {
        this.messages = messages;
        this.provider = provider;
        this.balances = balances;
        this.events = events;
        this.clock = clock;
    }

    @CircuitBreaker(name = "commsService", fallbackMethod = "sendFallback")
    public MessageResult send(SendMessageCommand cmd) {
        BigDecimal balance = balances.balanceOf(cmd.sender());
        if (balance.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InterdictedException("403", "Insufficient balance");
        }

        Instant now = Instant.now(clock);
        Message queued = messages.save(Message.queued(UUID.randomUUID(),
                cmd.sender(), cmd.receiver(), cmd.body(), now));
        events.queued(queued);

        try {
            ProviderSendResult sent = provider.send(cmd.receiver(), cmd.body());
            Message persisted = messages.save(queued.markSent(
                    sent.providerId(), sent.price(), sent.priceUnit(), Instant.now(clock)));
            events.sent(persisted);
            return MessageResult.from(persisted);
        } catch (InvalidAuthorizationException e) {
            markFailed(queued, e.getMessage());
            throw e;
        } catch (RuntimeException e) {
            markFailed(queued, e.getMessage());
            throw e;
        }
    }

    public MessageResult get(GetMessageCommand cmd) {
        Message message = messages.findById(cmd.messageId())
                .orElseThrow(() -> new NotFound("404", "Message not found"));
        if (!message.sender().equals(cmd.requester())) {
            throw new InterdictedException("403", "Message not accessible");
        }
        return MessageResult.from(message);
    }

    private void markFailed(Message message, String reason) {
        Message failed = messages.save(message.markFailed(reason, Instant.now(clock)));
        events.failed(failed, reason);
    }

    @SuppressWarnings("unused")
    private MessageResult sendFallback(SendMessageCommand cmd, Throwable t) {
        logger.error("Comms circuit breaker open: {}", t.getMessage());
        throw new CircuitBreakerException("503", "Comms service unavailable, please try again.");
    }
}
