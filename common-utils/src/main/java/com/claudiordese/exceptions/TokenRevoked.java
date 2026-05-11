package com.claudiordese.exceptions;

public class TokenRevoked extends GlobalException {
    public TokenRevoked(String code,String message) {
        super(code,message);
    }
}
