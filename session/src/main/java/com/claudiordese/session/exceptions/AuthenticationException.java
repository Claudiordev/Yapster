package com.claudiordese.session.exceptions;

import com.claudiordese.library.exceptions.LibraryException;

public class AuthenticationException extends LibraryException {

    public AuthenticationException(String code, String message) {
        super(code, message);
    }
}
