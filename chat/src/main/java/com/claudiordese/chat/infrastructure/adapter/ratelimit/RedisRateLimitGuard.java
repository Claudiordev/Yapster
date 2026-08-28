package com.claudiordese.chat.infrastructure.adapter.ratelimit;

import com.claudiordese.chat.application.port.ratelimit.RateLimitGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

@Component
@RequiredArgsConstructor
public class RedisRateLimitGuard implements RateLimitGuard {

    private static final RedisScript<Long> INCREMENT_WITH_EXPIRY = RedisScript.of(
            "local count = redis.call('INCR', KEYS[1]) "
                    + "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end "
                    + "return count",
            Long.class);

    private final StringRedisTemplate redis;

    @Override
    public boolean tryConsume(String key, int limit, Duration window) {
        Long count = redis.execute(
                INCREMENT_WITH_EXPIRY,
                List.of("rate_limit:" + key),
                String.valueOf(window.toMillis()));

        return count != null && count <= limit;
    }
}
