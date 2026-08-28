package com.claudiordese.session.application.config;

import java.time.Duration;

public record RegisterRateLimitPolicy(int maxAttempts, Duration window) {}
