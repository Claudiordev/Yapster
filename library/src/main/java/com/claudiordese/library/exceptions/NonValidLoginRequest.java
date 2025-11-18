package com.claudiordese.library.exceptions;

public class NonValidLoginRequest extends RuntimeException {
    public NonValidLoginRequest() {
        super("The user or password is not valid!");
    }
}
