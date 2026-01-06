package com.claudiordese.exceptions;

public class CircuitBreakerException extends GlobalException {
    public CircuitBreakerException(String code, String message) {
        super(code,message);
    }
}
