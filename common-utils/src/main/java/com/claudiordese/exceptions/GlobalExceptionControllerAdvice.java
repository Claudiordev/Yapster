package com.claudiordese.exceptions;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.net.URI;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionControllerAdvice {
    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionControllerAdvice.class);

    private static final Map<Class<? extends Exception>, HttpStatus> STATUS_MAPPING = Map.ofEntries(
            Map.entry(RateLimitException.class, HttpStatus.TOO_MANY_REQUESTS),
            Map.entry(CircuitBreakerException.class, HttpStatus.SERVICE_UNAVAILABLE),
            Map.entry(InterdictedException.class, HttpStatus.FORBIDDEN),
            Map.entry(InvalidAuthorizationException.class, HttpStatus.UNAUTHORIZED)
    );

    @ExceptionHandler(GlobalException.class)
    public ResponseEntity<?> handleLibraryException(GlobalException e, HttpServletRequest request) {
        logger.warn("Error: {}, details: {}",e.getCode(),e.getMessage());
        HttpStatus httpStatus = STATUS_MAPPING.entrySet()
                .stream()
                .filter(y -> y.getKey().isAssignableFrom(e.getClass()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(HttpStatus.INTERNAL_SERVER_ERROR);

        var problemDetail = ProblemDetail.forStatus(httpStatus);
        problemDetail.setTitle(e.getCode());
        problemDetail.setDetail(e.getMessage());
        problemDetail.setType(URI.create("http://localhost:8080/error/" + e.getCode()));
        problemDetail.setProperty("code", e.getCode());
        problemDetail.setProperty("message", e.getMessage());
        problemDetail.setInstance(URI.create(request.getRequestURI()));

        return ResponseEntity.status(httpStatus).body(problemDetail);
    }

    @PostConstruct
    public void init() {
        logger.info("GlobalExceptionControlerAdvice loaded");
    }
}
