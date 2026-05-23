package com.claudiordese.session.application.service.result;

import com.fasterxml.jackson.annotation.JsonProperty;

public record LoginResult(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn) {
}
