package com.claudiordese.session.dto;

public record LoginResponse(String accessToken, String refreshToken, String tokenType, long expiresIn) {
}
