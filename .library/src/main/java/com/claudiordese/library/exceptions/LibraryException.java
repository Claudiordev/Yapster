package com.claudiordese.library.exceptions;

import lombok.Getter;

@Getter
public class LibraryException extends RuntimeException {
    private final String code;

    public LibraryException(String code, String message) {
        super(message);
        this.code = code;
    }
}
