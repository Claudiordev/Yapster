package com.claudiordese.session.support;

import com.claudiordese.session.application.port.RateLimitGuard;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

public class InMemoryRateLimitGuard implements RateLimitGuard {

    private final Map<String, Integer> attempts = new HashMap<>();

    @Override
    public boolean tryConsume(String key, int limit, Duration window) {
        return attempts.merge(key, 1, Integer::sum) <= limit;
    }
}
