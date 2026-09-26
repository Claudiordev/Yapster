package com.claudiordese.session.infrastructure.configurations;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.util.List;

/**
 * "Sign in with Google" settings.
 *
 * @param clientId              OAuth client id (public); blank disables Google login
 * @param clientSecret          OAuth client secret; only ever used server-side, here
 * @param redirectUris          the only redirect URIs a login may use (must also be
 *                              registered in Google Cloud)
 * @param mergeExistingEmail    when Google's verified email matches an existing account,
 *                              link Google to that account instead of refusing. NOTE: local
 *                              sign-ups are not email-verified yet, so someone could
 *                              pre-register a victim's email and share the account; switch
 *                              this off if that risk stops being acceptable.
 */
@ConfigurationProperties(prefix = "auth.google")
public record GoogleAuthProperties(
        @DefaultValue("") String clientId,
        @DefaultValue("") String clientSecret,
        @DefaultValue({}) List<String> redirectUris,
        @DefaultValue("true") boolean mergeExistingEmail) {

    public boolean enabled() {
        return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
    }
}
