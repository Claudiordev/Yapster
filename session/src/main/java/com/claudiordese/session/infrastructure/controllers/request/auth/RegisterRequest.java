package com.claudiordese.session.infrastructure.controllers.request.auth;

public record RegisterRequest(String username, String email, String confirmEmail, String password) {
}
