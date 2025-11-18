package com.claudiordese.library.layers.rest;

import com.claudiordese.library.exceptions.response.ErrorResponse;
import com.claudiordese.library.exceptions.UnauthorizedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class RestExceptionHandler {
    private final Logger logger = LoggerFactory.getLogger(RestExceptionHandler.class);

    @ExceptionHandler
    public ResponseEntity<ErrorResponse> handleException(RuntimeException runtimeException) {
        logger.warn(runtimeException.getMessage());

        ErrorResponse errorResponse = new ErrorResponse();
        HttpStatus status = mapToStatus(runtimeException);

        errorResponse.setMessage(runtimeException.getMessage());
        errorResponse.setStatus(status.value());

        return new ResponseEntity<>(errorResponse, status);
    }

    public HttpStatus mapToStatus(Exception exception) {
        if (exception instanceof UnauthorizedException) {
            return HttpStatus.UNAUTHORIZED;
        }

        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
}
