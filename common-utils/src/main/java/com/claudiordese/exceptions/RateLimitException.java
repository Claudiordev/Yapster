package com.claudiordese.exceptions;

public class RateLimitException extends GlobalException {

    public RateLimitException(String code, String message) {
        super(code,message);
    }
}
