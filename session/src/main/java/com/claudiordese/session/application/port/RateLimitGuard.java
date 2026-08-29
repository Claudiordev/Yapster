package com.claudiordese.session.application.port;

import java.time.Duration;

public interface RateLimitGuard {

    boolean tryConsume(String key, int limit, Duration window);
}
