package com.claudiordese.exceptions;

import com.claudiordese.utils.ProblemDetails;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;

@ControllerAdvice
public class GlobalExceptionControllerAdvice {
    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionControllerAdvice.class);

    /**
     * One exception class per HTTP status. Differentiate the specific reason via the
     * exception's {@code code} and {@code message} fields, not by subclassing.
     * Legacy specific exceptions (UsernameTaken, InvalidAuthorizationException, …)
     * are kept for compatibility — new code should use the general families.
     */
    private static final Map<Class<? extends Exception>, HttpStatus> STATUS_MAPPING = Map.ofEntries(
            // General families — preferred for new code
            Map.entry(BadRequestException.class, HttpStatus.BAD_REQUEST),
            Map.entry(UnauthorizedException.class, HttpStatus.UNAUTHORIZED),
            Map.entry(ForbiddenException.class, HttpStatus.FORBIDDEN),
            Map.entry(NotFoundException.class, HttpStatus.NOT_FOUND),
            Map.entry(ConflictException.class, HttpStatus.CONFLICT),
            Map.entry(TooManyRequestsException.class, HttpStatus.TOO_MANY_REQUESTS),
            Map.entry(ServiceUnavailableException.class, HttpStatus.SERVICE_UNAVAILABLE),

            // Legacy specific exceptions — kept for existing services
            Map.entry(RateLimitException.class, HttpStatus.TOO_MANY_REQUESTS),
            Map.entry(CircuitBreakerException.class, HttpStatus.SERVICE_UNAVAILABLE),
            Map.entry(InterdictedException.class, HttpStatus.FORBIDDEN),
            Map.entry(InvalidAuthorizationException.class, HttpStatus.UNAUTHORIZED),
            Map.entry(NotFound.class, HttpStatus.NOT_FOUND),
            Map.entry(UsernameTaken.class, HttpStatus.CONFLICT),
            Map.entry(EmailMismatchException.class, HttpStatus.BAD_REQUEST),
            Map.entry(EmailTakenException.class, HttpStatus.CONFLICT)
    );

    @ExceptionHandler(GlobalException.class)
    public ResponseEntity<ProblemDetail> handleLibraryException(GlobalException e, HttpServletRequest request) {
        logger.warn("Error: {}, details: {}", e.getCode(), e.getMessage());
        HttpStatus httpStatus = STATUS_MAPPING.entrySet()
                .stream()
                .filter(y -> y.getKey().isAssignableFrom(e.getClass()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(HttpStatus.INTERNAL_SERVER_ERROR);

        ProblemDetail problem = ProblemDetails.of(httpStatus, e.getCode(), e.getMessage(), request.getRequestURI());
        return ResponseEntity.status(httpStatus).body(problem);
    }

    @PostConstruct
    public void init() {
        logger.info("GlobalExceptionControlerAdvice loaded");
    }
}
