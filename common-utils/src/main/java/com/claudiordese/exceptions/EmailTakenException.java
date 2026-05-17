package com.claudiordese.exceptions;

public class EmailTakenException extends GlobalException {
    public EmailTakenException(String code,String message) {
        super(code,message);
    }
}
