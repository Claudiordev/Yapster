package com.claudiordese.session.application.domain;

import java.time.Instant;

/** An external login (e.g. a Google account) linked to a user, as shown in their settings. */
public record LinkedProvider(String provider, String email, Instant linkedAt) {}
