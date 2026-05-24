package com.claudiordese.exceptions;

/**
 * The request was malformed or violated a precondition the caller can fix.
 * Maps to HTTP 400. Differentiate scenarios via the {@code code}/{@code message}.
 */
public class BadRequestException extends GlobalException {
    public BadRequestException(String code, String message) {
        super(code, message);
    }
}
