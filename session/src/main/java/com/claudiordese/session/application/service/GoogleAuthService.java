package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.BadRequestException;
import com.claudiordese.exceptions.ConflictException;
import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.exceptions.ServiceUnavailableException;
import com.claudiordese.exceptions.TooManyRequestsException;
import com.claudiordese.session.application.config.LoginRateLimitPolicy;
import com.claudiordese.session.application.domain.GoogleIdentity;
import com.claudiordese.session.application.domain.User;
import com.claudiordese.session.application.domain.UsernameGenerator;
import com.claudiordese.session.application.port.GoogleIdentityClient;
import com.claudiordese.session.application.port.RateLimitGuard;
import com.claudiordese.session.application.port.UserProviderStore;
import com.claudiordese.session.application.port.UserStore;
import com.claudiordese.session.application.service.commands.GoogleLoginCommand;
import com.claudiordese.session.application.service.result.LoginResult;
import com.claudiordese.session.infrastructure.configurations.GoogleAuthProperties;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

/**
 * "Sign in with Google": exchanges the authorization code, then logs the matching user
 * in, creating or linking one as needed, and issues the normal session tokens.
 *
 * Account resolution, in order:
 * 1. a user already linked to this Google account (the stable {@code sub}, not the email);
 * 2. otherwise a user with the same email: linked to Google (merged) when merging is on;
 * 3. otherwise a new user, with a username built from the email and no password.
 */
@Service
public class GoogleAuthService {

    static final String PROVIDER = "google";

    private final GoogleIdentityClient google;
    private final UserStore users;
    private final UserProviderStore providers;
    private final AuthService auth;
    private final RateLimitGuard rateLimitGuard;
    private final LoginRateLimitPolicy rateLimitPolicy;
    private final GoogleAuthProperties properties;

    public GoogleAuthService(GoogleIdentityClient google,
                             UserStore users,
                             UserProviderStore providers,
                             AuthService auth,
                             RateLimitGuard rateLimitGuard,
                             LoginRateLimitPolicy rateLimitPolicy,
                             GoogleAuthProperties properties) {
        this.google = google;
        this.users = users;
        this.providers = providers;
        this.auth = auth;
        this.rateLimitGuard = rateLimitGuard;
        this.rateLimitPolicy = rateLimitPolicy;
        this.properties = properties;
    }

    @Transactional
    public LoginResult login(GoogleLoginCommand command) {
        if (!properties.enabled()) {
            throw new ServiceUnavailableException("google_login_disabled", "Google sign-in is not available");
        }
        if (!rateLimitGuard.tryConsume("google-login:" + command.clientIp(),
                rateLimitPolicy.maxAttempts(), rateLimitPolicy.window())) {
            throw new TooManyRequestsException("login_rate_limit_exceeded",
                    "Too many login attempts. Please try again later");
        }
        // Only redirect URIs we registered may be used (the web app supplies it).
        if (!properties.redirectUris().contains(command.redirectUri())) {
            throw new BadRequestException("invalid_redirect_uri", "Redirect URI is not allowed");
        }

        GoogleIdentity identity = google.exchange(
                command.code(), command.redirectUri(), command.codeVerifier(), command.nonce());

        if (!identity.emailVerified()) {
            throw new InvalidAuthorizationException("google_email_unverified",
                    "Your Google email is not verified");
        }
        return auth.loginAs(resolveUser(identity));
    }

    private User resolveUser(GoogleIdentity identity) {
        var linked = providers.findUserId(PROVIDER, identity.subject()).flatMap(users::findById);

        if (linked.isPresent()) return linked.get();

        var sameEmail = users.findByEmail(identity.email());

        if (sameEmail.isPresent()) {
            if (!properties.mergeExistingEmail()) {
                throw new ConflictException("email_taken",
                        "An account with this email already exists. Log in with your password.");
            }
            providers.link(sameEmail.get().id(), PROVIDER, identity.subject(), identity.email());
            return sameEmail.get();
        }

        String username = UsernameGenerator.fromEmail(identity.email(), users::existsByUsername);
        User created = users.create(username, identity.email(), null);

        providers.link(created.id(), PROVIDER, identity.subject(), identity.email());
        return created;
    }
}
