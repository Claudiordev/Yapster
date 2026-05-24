package com.claudiordese.exceptions;

/**
 * The requested resource doesn't exist. Maps to HTTP 404.
 */
public class NotFoundException extends GlobalException {
    public NotFoundException(String code, String message) {
        super(code, message);
    }
}
