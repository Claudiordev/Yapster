package com.claudiordese.library.exceptions;

public class LoggedInException extends RuntimeException {
    public LoggedInException(String username){
        super("Player with username " + username + " is logged in.");
    }
}
