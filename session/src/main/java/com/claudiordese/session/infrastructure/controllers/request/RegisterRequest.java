package com.claudiordese.session.infrastructure.controllers.request;

public record RegisterRequest(String username, String email, String confirmEmail, String password) {
}
