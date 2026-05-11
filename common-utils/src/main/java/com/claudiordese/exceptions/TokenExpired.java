package com.claudiordese.exceptions;

public class TokenExpired extends GlobalException {
    public TokenExpired(String code,String message) {
        super(code,message);
    }
}
