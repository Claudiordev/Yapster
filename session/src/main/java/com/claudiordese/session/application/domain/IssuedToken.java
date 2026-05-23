package com.claudiordese.session.application.domain;

public record IssuedToken(String accessToken, long expiresInSeconds) {}
