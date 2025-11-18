package com.claudiordese.exceptions;

public class InvalidAuthorizationException extends GlobalException {
    public InvalidAuthorizationException(String code, String message) {
        super(code, message);
    }
}
