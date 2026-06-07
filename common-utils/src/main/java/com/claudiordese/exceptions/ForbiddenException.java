package com.claudiordese.exceptions;

/**
 * The caller is authenticated but isn't permitted to perform this action.
 * Maps to HTTP 403.
 */
public class ForbiddenException extends GlobalException {
    public ForbiddenException(String code, String message) {
        super(code, message);
    }
}
