package com.claudiordese.session.infrastructure.controllers;

import com.claudiordese.utils.ProblemDetails;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Safety net for JPA concurrency losses. If two transactions race to modify or
 * delete the same row, the loser surfaces an {@link OptimisticLockingFailureException}
 * (e.g. Hibernate's {@code StaleObjectStateException}). Left unhandled it becomes a
 * 500; here it degrades to a retryable 409 Conflict, which is its correct semantic —
 * "someone else changed this, try again" — not an authentication problem.
 *
 * <p>The refresh-token rotation path no longer reaches this handler (rotation now
 * consumes the token with a bulk delete and a row-count check), but this guards any
 * other optimistic-lock race in the service.
 */
@RestControllerAdvice
public class ConcurrencyExceptionAdvice {

    private static final Logger logger = LoggerFactory.getLogger(ConcurrencyExceptionAdvice.class);

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ProblemDetail> handleOptimisticLock(
            OptimisticLockingFailureException e, HttpServletRequest request) {
        logger.warn("Optimistic locking failure on {}: {}", request.getRequestURI(), e.getMessage());
        ProblemDetail problem = ProblemDetails.of(
                HttpStatus.CONFLICT,
                "concurrent_modification",
                "The resource was modified by another request. Please retry.",
                request.getRequestURI());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }
}
