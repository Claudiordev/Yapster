package com.claudiordese.voice.infrastructure.adapter.chat;

import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.service.annotation.GetExchange;

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
}
