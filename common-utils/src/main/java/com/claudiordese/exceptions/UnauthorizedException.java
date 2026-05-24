package com.claudiordese.exceptions;

/**
 * The caller is unauthenticated, the token is invalid/expired/revoked, or the
 * credentials supplied don't match. Maps to HTTP 401.
 */
public class UnauthorizedException extends GlobalException {
    public UnauthorizedException(String code, String message) {
        super(code, message);
    }
}
