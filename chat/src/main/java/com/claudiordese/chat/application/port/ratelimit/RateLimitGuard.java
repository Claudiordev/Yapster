package com.claudiordese.chat.application.port.ratelimit;

import java.time.Duration;

public interface RateLimitGuard {

    boolean tryConsume(String key, int limit, Duration window);
}
