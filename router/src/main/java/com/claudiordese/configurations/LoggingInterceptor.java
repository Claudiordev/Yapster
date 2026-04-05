package com.claudiordese.configurations;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;

import reactor.core.publisher.Mono;

@Component
public class LoggingInterceptor implements WebFilter {
    private final Logger logger = LoggerFactory.getLogger(LoggingInterceptor.class);

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        var req = exchange.getRequest();
        logger.info("Request URI: {}, route path: {}", req.getURI(), req.getPath());
        return chain.filter(exchange);
    }
}
