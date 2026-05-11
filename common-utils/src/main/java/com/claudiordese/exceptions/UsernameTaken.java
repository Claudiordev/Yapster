package com.claudiordese.exceptions;

public class UsernameTaken extends GlobalException {
    public UsernameTaken(String code,String message) {
        super(code,message);
    }
}
