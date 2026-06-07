package com.claudiordese.exceptions;

/**
 * Thrown when an upstream service or external dependency is unreachable,
 * misconfigured, or returning unexpected errors. Maps to HTTP 503.
 * Use this for downstream failures (third-party APIs, message brokers,
 * cache layers) rather than {@link CircuitBreakerException}, which is
 * specific to a Resilience4j circuit-breaker fallback.
 */
public class ServiceUnavailableException extends GlobalException {
    public ServiceUnavailableException(String code, String message) {
        super(code, message);
    }
}
