package com.claudiordese.session.application.domain;

import java.util.Locale;
import java.util.UUID;
import java.util.function.Predicate;

/** Builds a username from an email address: {@code user@gmail.com} becomes {@code user}. */
public final class UsernameGenerator {

    static final int MIN_LENGTH = 3;
    static final int MAX_LENGTH = 30;

    private UsernameGenerator() {}

    /**
     * Local part of the email, lowercased and cleaned to letters, digits, dot, dash and
     * underscore, padded to the minimum length and cut to the maximum. If taken, a number
     * is appended (user2, user3, ...).
     *
     * @param taken whether a username already exists
     */
    public static String fromEmail(String email, Predicate<String> taken) {
        String local = email == null ? "" : email.substring(0, Math.max(0, email.indexOf('@') < 0 ? email.length() : email.indexOf('@')));
        String base = local.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "_");

        if (base.isBlank()) base = "user";
        if (base.length() < MIN_LENGTH) base = base + "123".substring(0, MIN_LENGTH - base.length());
        if (base.length() > MAX_LENGTH) base = base.substring(0, MAX_LENGTH);

        if (!taken.test(base)) return base;

        for (int n = 2; n <= 200; n++) {
            String suffix = String.valueOf(n);
            String candidate = base.substring(0, Math.min(base.length(), MAX_LENGTH - suffix.length())) + suffix;

            if (!taken.test(candidate)) return candidate;
        }
        // Extremely unlikely: fall back to a random tail.
        String tail = UUID.randomUUID().toString().substring(0, 6);

        return base.substring(0, Math.min(base.length(), MAX_LENGTH - tail.length())) + tail;
    }
}
