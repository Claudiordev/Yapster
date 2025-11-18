package com.claudiordese.exceptions;

import lombok.Getter;

@Getter
public class GlobalException extends RuntimeException{
    private final String code;

    public GlobalException(String code, String message) {
        super(message);
        this.code = code;
    }
}
