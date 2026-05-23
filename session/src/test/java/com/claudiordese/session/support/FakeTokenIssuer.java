package com.claudiordese.session.support;

import com.claudiordese.session.application.domain.IssuedToken;
import com.claudiordese.session.application.domain.User;
import com.claudiordese.session.application.port.TokenIssuer;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

public class FakeTokenIssuer implements TokenIssuer {

    private final AtomicInteger counter = new AtomicInteger();

    @Override
    public IssuedToken issue(User user, Duration ttl) {
        String token = "fake-jwt-" + user.id() + "-" + counter.incrementAndGet() + "-" + UUID.randomUUID();
        return new IssuedToken(token, ttl.toSeconds());
    }
}
