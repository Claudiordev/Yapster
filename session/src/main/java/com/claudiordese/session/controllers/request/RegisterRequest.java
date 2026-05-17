package com.claudiordese.session.controllers.request;

public record RegisterRequest(String username, String email, String confirmEmail, String password) {
}
