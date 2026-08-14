package com.claudiordese.session.application.service.result;

public record LoginResult(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn) {
}
