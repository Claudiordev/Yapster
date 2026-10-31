package com.claudiordese.chat.application.config;

import java.time.Duration;

public record ReactionRateLimitPolicy(int maxAttempts, Duration window) {}
