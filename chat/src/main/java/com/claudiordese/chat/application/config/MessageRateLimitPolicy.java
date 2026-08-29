package com.claudiordese.chat.application.config;

import java.time.Duration;

public record MessageRateLimitPolicy(int maxAttempts, Duration window) {}
