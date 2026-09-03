package com.claudiordese.voice.infrastructure.adapter.chat;

import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.PostExchange;

/**
 * Declarative HTTP client for the chat service, backed by a load-balanced
 * {@link org.springframework.web.client.RestClient} (see {@code ChatClientConfig}).
 * "http://chat/..." resolves via Eureka to whichever instance is registered --
 * no hardcoded host/port, same as the router's gateway routes.
 */
public interface ChatClient {

    /**
     * 204 if the caller is a member of the conversation; a non-2xx response
     * (404/403 from chat) surfaces as a {@link org.springframework.web.client.RestClientResponseException}.
     */
    @GetExchange("/chat/{conversationId}/membership")
    void checkMembership(
            @PathVariable String conversationId,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization);

    @GetExchange("/chat/{conversationId}/call-moderation/{targetUserId}")
    void checkCallModeration(
            @PathVariable String conversationId,
            @PathVariable String targetUserId,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization);

    @PostExchange("/chat/internal/status")
    void publishCallStatus(
            @RequestHeader("X-Internal-Secret") String secret,
            @RequestBody CallStatusPayload status);

    record CallStatusPayload(String conversationId, boolean ongoing, int participantCount) {}
}
