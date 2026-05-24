package com.claudiordese.comms.service;

import com.claudiordese.comms.client.SessionClient;
import com.claudiordese.comms.dto.LogEvent;
import com.claudiordese.comms.dto.MessageEvent;
import com.claudiordese.comms.dto.MessageResponse;
import com.claudiordese.comms.dto.ProviderMessage;
import com.claudiordese.comms.dto.SendMessageRequest;
import com.claudiordese.comms.entity.Message;
import com.claudiordese.comms.entity.MessageStatus;
import com.claudiordese.comms.repository.MessageRepository;
import com.claudiordese.exceptions.CircuitBreakerException;
import com.claudiordese.exceptions.InterdictedException;
import com.claudiordese.exceptions.InvalidAuthorizationException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class CommsService {

    private static final Logger logger = LoggerFactory.getLogger(CommsService.class);

    private final RestClient commsRestClient;
    private final SessionClient sessionClient;
    private final MessageRepository messageRepository;
    private final Optional<CommsProducer> producer;
    private final String senderNumber;
    private final String sid;

    public CommsService(RestClient commsRestClient,
                        SessionClient sessionClient,
                        MessageRepository messageRepository,
                        Optional<CommsProducer> producer,
                        @Value("${comms.provider.sid}") String sid,
                        @Value("${comms.provider.sender.phone_number}") String senderNumber) {
        this.commsRestClient = commsRestClient;
        this.sessionClient = sessionClient;
        this.messageRepository = messageRepository;
        this.producer = producer;
        this.sid = sid;
        this.senderNumber = senderNumber;
    }

    @Transactional
    @CircuitBreaker(name = "commsService", fallbackMethod = "sendFallback")
    public MessageResponse sendMessage(SendMessageRequest request) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        BigDecimal balance = sessionClient.getBalance(username);

        if (balance.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InterdictedException("403", "Insufficient balance");
        }

        Message message = new Message();
        message.setSender(username);
        message.setReceiver(request.receiver());
        message.setBody(request.message());
        message.setStatus(MessageStatus.QUEUED);
        messageRepository.save(message);

        producer.ifPresent(p -> p.publishLog(LogEvent.info(
                "MESSAGE_QUEUED", username, message.getId().toString(),
                "Queued message to " + request.receiver())));

        try {
            ProviderMessage providerResponse = commsRestClient.post()
                    .uri("/2010-04-01/Accounts/" + sid + "/Messages.json")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(
                            "To=" + encode(request.receiver()) +
                            "&From=" + encode(senderNumber) +
                            "&Body=" + encode(request.message()))
                    .retrieve()
                    .onStatus(status -> status.value() == 401, (req, res) -> {
                        throw new InvalidAuthorizationException("401", "No permission to send messages, verify the provider configuration.");
                    })
                    .body(ProviderMessage.class);

            message.setStatus(MessageStatus.SENT);
            message.setProviderId(providerResponse != null ? providerResponse.sid() : null);
            message.setPrice(providerResponse != null ? providerResponse.price() : null);
            message.setPriceUnit(providerResponse != null ? providerResponse.priceUnit() : null);
            message.setUpdatedAt(Instant.now());
            messageRepository.save(message);

            producer.ifPresent(p -> {
                p.publishMessage(new MessageEvent(
                        message.getId().toString(), username, request.receiver(),
                        message.getStatus().name(), message.getProviderId(), Instant.now()));
                p.publishLog(LogEvent.info(
                        "MESSAGE_SENT", username, message.getId().toString(),
                        "Provider id " + message.getProviderId()));
            });

            return MessageResponse.from(message);
        } catch (InvalidAuthorizationException e) {
            markFailed(message, username, e.getMessage());
            throw e;
        } catch (RuntimeException e) {
            markFailed(message, username, e.getMessage());
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public MessageResponse getMessage(String id) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        Message message = messageRepository.findById(UUID.fromString(id))
                .orElseThrow(() -> new InterdictedException("404", "Message not found"));
        if (!message.getSender().equals(username)) {
            throw new InterdictedException("403", "Message not accessible");
        }
        return MessageResponse.from(message);
    }

    private void markFailed(Message message, String username, String reason) {
        message.setStatus(MessageStatus.FAILED);
        message.setErrorMessage(reason);
        message.setUpdatedAt(Instant.now());
        messageRepository.save(message);
        producer.ifPresent(p -> p.publishLog(LogEvent.error(
                "MESSAGE_FAILED", username, message.getId().toString(), reason)));
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    @SuppressWarnings("unused")
    private MessageResponse sendFallback(SendMessageRequest request, Throwable t) {
        logger.error("Comms circuit breaker open: {}", t.getMessage());
        throw new CircuitBreakerException("503", "Comms service unavailable, please try again.");
    }
}
