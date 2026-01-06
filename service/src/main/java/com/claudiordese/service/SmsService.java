package com.claudiordese.service;

import com.claudiordese.dto.Message;
import com.claudiordese.dto.MessageRequest;

import com.claudiordese.exceptions.CircuitBreakerException;
import com.claudiordese.exceptions.InterdictedException;
import com.claudiordese.exceptions.RateLimitException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
public class SmsService {

    @Value("${twilio.sender.phone_number}")
    private String senderNumber;
    private String SID;
    private final RestClient restClient;
    private Logger logger = LoggerFactory.getLogger(SmsService.class);

    public SmsService(RestClient restClient,
                      @Value("${twilio.sid}") String SID,
                      @Value("${twilio.sender.phone_number}") String senderNumber) {
        this.restClient = restClient;
        this.SID = SID;
        this.senderNumber = senderNumber;
    }

    public Message getMessage(String id) {
        return restClient.get().uri("/2010-04-01/Accounts/{SID}/Messages/{id}").retrieve().body(Message.class);
    }

    @RateLimiter(name="sms", fallbackMethod = "rateLimitFallback")
    @CircuitBreaker(name="sms", fallbackMethod = "sendFallback")
    public Message sendMessage(MessageRequest messageRequest) {
        logger.debug("SID: {}",SID);
        logger.debug("Sender: {}", senderNumber);

        return restClient.post().uri("/2010-04-01/Accounts/" + SID + "/Messages.json")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(
                        "To=" + encode(messageRequest.receiver()) +
                        "&From=" + encode(senderNumber) +
                        "&Body=" + encode(messageRequest.message())
                ).retrieve()
                .onStatus(status -> status.value() == 401,
                        (request, response) -> {
                            throw new InterdictedException("401", "No permission to send SMS, verify the service configuration.");
                        }
                ).body(Message.class);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private Message sendFallback(MessageRequest request, Throwable t) {
        throw new CircuitBreakerException("503","Service unavailable, please try again.");
    }

    private Message rateLimitFallback(MessageRequest request, Throwable t) {
        throw new RateLimitException("429", "Too many requests, please try again.");
    }

}
