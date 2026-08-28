package com.claudiordese.session.application.config;

import java.time.Duration;

public record LoginRateLimitPolicy(int maxAttempts, Duration window) {}
