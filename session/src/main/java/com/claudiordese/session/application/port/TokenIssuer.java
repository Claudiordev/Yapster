package com.claudiordese.session.application.port;

import com.claudiordese.session.application.domain.IssuedToken;
import com.claudiordese.session.application.domain.User;

import java.time.Duration;

public interface TokenIssuer {

    IssuedToken issue(User user, Duration ttl);
}
