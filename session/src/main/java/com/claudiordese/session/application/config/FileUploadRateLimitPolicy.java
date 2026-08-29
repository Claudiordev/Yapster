package com.claudiordese.session.application.config;

import java.time.Duration;

public record FileUploadRateLimitPolicy(int maxAttempts, Duration window) {}
