package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.BadRequestException;
import com.claudiordese.exceptions.ConflictException;
import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.exceptions.NotFoundException;
import com.claudiordese.exceptions.ServiceUnavailableException;
import com.claudiordese.exceptions.TooManyRequestsException;
import com.claudiordese.session.application.config.LoginRateLimitPolicy;
import com.claudiordese.session.application.domain.GoogleIdentity;
import com.claudiordese.session.application.domain.LinkedProvider;
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

import java.time.Instant;
import java.util.List;
import java.util.UUID;

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
        GoogleIdentity identity = verifiedIdentity(command, "google-login:" + command.clientIp());

        return auth.loginAs(resolveUser(identity));
    }

    /** Everything linked to the user (shown in their settings). */
    public List<LinkedProvider> linkedProviders(UUID userId) {
        return providers.findByUser(userId);
    }

    /**
     * Links a Google account to an already signed-in user, from their settings. Unlike
     * {@link #login} this never creates a user or issues tokens, and it never merges by
     * email: the user picks the account explicitly.
     */
    @Transactional
    public LinkedProvider link(UUID userId, GoogleLoginCommand command) {
        GoogleIdentity identity = verifiedIdentity(command, "google-link:" + userId);
        var owner = providers.findUserId(PROVIDER, identity.subject());

        if (owner.isPresent()) {
            if (owner.get().equals(userId)) {
                return providers.findByUser(userId).stream()
                        .filter(linked -> PROVIDER.equals(linked.provider()))
                        .findFirst()
                        .orElseThrow();
            }
            throw new ConflictException("google_account_taken",
                    "That Google account is already linked to another user");
        }
        if (providers.findByUser(userId).stream().anyMatch(linked -> PROVIDER.equals(linked.provider()))) {
            throw new ConflictException("google_already_linked",
                    "A Google account is already linked. Unlink it first");
        }

        providers.link(userId, PROVIDER, identity.subject(), identity.email());
        return new LinkedProvider(PROVIDER, identity.email(), Instant.now());
    }

    /** Removes a linked provider, as long as the user can still sign in some other way. */
    @Transactional
    public void unlink(UUID userId, String provider) {
        if (!PROVIDER.equals(provider)) {
            throw new BadRequestException("unknown_provider", "Unknown login provider");
        }

        List<LinkedProvider> linked = providers.findByUser(userId);

        if (linked.stream().noneMatch(entry -> provider.equals(entry.provider()))) {
            throw new NotFoundException("provider_not_linked", "That account is not linked");
        }

        User user = users.findById(userId)
                .orElseThrow(() -> new NotFoundException("user_not_found", "User not found"));
        boolean hasPassword = user.passwordHash() != null && !user.passwordHash().isBlank();
        boolean hasOtherProvider = linked.stream().anyMatch(entry -> !provider.equals(entry.provider()));

        if (!hasPassword && !hasOtherProvider) {
            throw new ConflictException("last_sign_in_method",
                    "This is your only way to sign in. Add a password before unlinking it");
        }

        providers.unlink(userId, provider);
    }

    /** Shared by sign-in and linking: feature flag, rate limit, redirect URI, code exchange, verified email. */
    private GoogleIdentity verifiedIdentity(GoogleLoginCommand command, String rateLimitKey) {
        if (!properties.enabled()) {
            throw new ServiceUnavailableException("google_login_disabled", "Google sign-in is not available");
        }
        if (!rateLimitGuard.tryConsume(rateLimitKey,
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
        return identity;
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
