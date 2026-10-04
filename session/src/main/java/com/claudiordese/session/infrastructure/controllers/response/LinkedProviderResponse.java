package com.claudiordese.session.infrastructure.controllers.response;

import com.claudiordese.session.application.domain.LinkedProvider;

import java.time.Instant;

/** One linked login provider, as listed in the user's settings. */
public record LinkedProviderResponse(String provider, String email, Instant linkedAt) {

    public static LinkedProviderResponse of(LinkedProvider linked) {
        return new LinkedProviderResponse(linked.provider(), linked.email(), linked.linkedAt());
    }
}
