package com.claudiordese.exceptions;

public class EmailMismatchException extends GlobalException {
    public EmailMismatchException(String code,String message) {
        super(code,message);
    }
}
