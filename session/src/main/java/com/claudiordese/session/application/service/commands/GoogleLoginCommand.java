package com.claudiordese.session.application.service.commands;

public record GoogleLoginCommand(String code, String redirectUri, String codeVerifier, String nonce, String clientIp) {}
