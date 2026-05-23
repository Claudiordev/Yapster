package com.claudiordese.session.support;

import com.claudiordese.session.application.port.PasswordHasher;

/**
 * Fake hasher for tests — encodes by prefixing with "hashed:" and matches by reversing that.
 * No crypto, intentionally cheap so tests are fast.
 */
public class PlainTextPasswordHasher implements PasswordHasher {

    @Override
    public String hash(String rawPassword) {
        return "hashed:" + rawPassword;
    }

    @Override
    public boolean matches(String rawPassword, String hashedPassword) {
        return hashedPassword.equals("hashed:" + rawPassword);
    }
}
