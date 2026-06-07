package com.claudiordese.exceptions;

/**
 * The caller exceeded a rate limit. Maps to HTTP 429.
 */
public class TooManyRequestsException extends GlobalException {
    public TooManyRequestsException(String code, String message) {
        super(code, message);
    }
}
