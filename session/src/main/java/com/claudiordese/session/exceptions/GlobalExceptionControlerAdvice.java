package com.claudiordese.session.exceptions;

import com.claudiordese.library.exceptions.LibraryException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.net.URI;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionControlerAdvice {

    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionControlerAdvice.class);

    private static final Map<Class<? extends Exception>, HttpStatus> STATUS_MAPPING = Map.ofEntries(
            Map.entry(AuthenticationException.class, HttpStatus.UNAUTHORIZED)
    );

    @ExceptionHandler(LibraryException.class)
    public ResponseEntity<?> handleLibraryException(LibraryException e, HttpServletRequest request) {
        HttpStatus httpStatus = STATUS_MAPPING.entrySet()
                .stream()
                .filter(y -> y.getKey().isAssignableFrom(e.getClass()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(HttpStatus.INTERNAL_SERVER_ERROR);

        var problemDetail = ProblemDetail.forStatus(httpStatus);
        problemDetail.setTitle(e.getCode());
        problemDetail.setDetail(e.getMessage());
        problemDetail.setType(URI.create("http://localhost:8080/errors/user" + e.getCode()));
        problemDetail.setProperty("code", e.getCode());
        problemDetail.setProperty("message", e.getMessage());
        problemDetail.setInstance(URI.create(request.getRequestURI()));

        return ResponseEntity.status(httpStatus).body(problemDetail);
    }
}
