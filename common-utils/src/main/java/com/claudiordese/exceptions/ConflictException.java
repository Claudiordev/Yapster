package com.claudiordese.exceptions;

/**
 * The request conflicts with current state (duplicate key, already taken,
 * version mismatch). Maps to HTTP 409.
 */
public class ConflictException extends GlobalException {
    public ConflictException(String code, String message) {
        super(code, message);
    }
}
