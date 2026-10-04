package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.BadRequestException;
import com.claudiordese.exceptions.ConflictException;
import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.exceptions.NotFoundException;
import com.claudiordese.exceptions.ServiceUnavailableException;
import com.claudiordese.session.application.config.LoginRateLimitPolicy;
import com.claudiordese.session.application.config.RegisterRateLimitPolicy;
import com.claudiordese.session.application.domain.GoogleIdentity;
import com.claudiordese.session.application.domain.LinkedProvider;
import com.claudiordese.session.application.domain.User;
import com.claudiordese.session.application.port.GoogleIdentityClient;
import com.claudiordese.session.application.service.commands.GoogleLoginCommand;
import com.claudiordese.session.application.service.commands.LoginCommand;
import com.claudiordese.session.application.service.result.LoginResult;
import com.claudiordese.session.infrastructure.configurations.GoogleAuthProperties;
import com.claudiordese.security.config.JwtSecurityProperties;
import com.claudiordese.session.support.FakeTokenIssuer;
import com.claudiordese.session.support.InMemoryRateLimitGuard;
import com.claudiordese.session.support.InMemoryRefreshTokenStore;
import com.claudiordese.session.support.InMemoryUserProviderStore;
import com.claudiordese.session.support.InMemoryUserStore;
import com.claudiordese.session.support.PlainTextPasswordHasher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GoogleAuthServiceTest {

    private static final String REDIRECT = "http://localhost:3000/api/auth/google/callback";

    private InMemoryUserStore users;
    private InMemoryUserProviderStore providers;
    private PlainTextPasswordHasher hasher;
    private AuthService auth;
    private GoogleIdentity identity;
    private GoogleAuthService service;

    private GoogleAuthService serviceWith(GoogleAuthProperties properties) {
        GoogleIdentityClient google = (code, redirectUri, verifier, nonce) -> identity;

        return new GoogleAuthService(google, users, providers, auth, new InMemoryRateLimitGuard(),
                new LoginRateLimitPolicy(10, Duration.ofMinutes(15)), properties);
    }

    private GoogleLoginCommand command() {
        return new GoogleLoginCommand("code", REDIRECT, "v".repeat(43), "nonce", "1.2.3.4");
    }

    @BeforeEach
    void setUp() {
        users = new InMemoryUserStore();
        providers = new InMemoryUserProviderStore();
        hasher = new PlainTextPasswordHasher();
        JwtSecurityProperties props = new JwtSecurityProperties();

        props.setAccessExpirationMs(900_000L);
        props.setRefreshExpirationMs(2_592_000_000L);
        auth = new AuthService(users, new InMemoryRefreshTokenStore(), hasher, new FakeTokenIssuer(), props,
                new InMemoryRateLimitGuard(), new LoginRateLimitPolicy(10, Duration.ofMinutes(15)),
                new RegisterRateLimitPolicy(5, Duration.ofHours(1)));
        identity = new GoogleIdentity("g-1", "user@gmail.com", true, "User", null);
        service = serviceWith(new GoogleAuthProperties("id", "secret", List.of(REDIRECT), true));
    }

    @Test
    void firstSignIn_createsAUserFromTheEmail_withoutAPassword() {
        LoginResult result = service.login(command());

        assertThat(result.accessToken()).isNotBlank();
        User created = users.findByEmail("user@gmail.com").orElseThrow();
        assertThat(created.username()).isEqualTo("user");
        assertThat(created.passwordHash()).isNull();
        assertThat(providers.findUserId("google", "g-1")).contains(created.id());
    }

    @Test
    void secondSignIn_usesTheLinkedUser_evenIfTheirEmailChanged() {
        service.login(command());
        User created = users.findByEmail("user@gmail.com").orElseThrow();
        identity = new GoogleIdentity("g-1", "renamed@gmail.com", true, "User", null);

        service.login(command());

        assertThat(providers.size()).isEqualTo(1);
        assertThat(users.findById(created.id())).isPresent();
        assertThat(users.findByEmail("renamed@gmail.com")).isEmpty();
    }

    @Test
    void anExistingPasswordAccountWithTheSameEmailIsMerged() {
        User existing = users.create("alice", "user@gmail.com", hasher.hash("secret123"));

        service.login(command());

        assertThat(providers.findUserId("google", "g-1")).contains(existing.id());
        // and the password still works
        assertThat(auth.login(new LoginCommand("alice", "secret123")).accessToken()).isNotBlank();
    }

    @Test
    void mergingCanBeSwitchedOff() {
        users.create("alice", "user@gmail.com", hasher.hash("secret123"));
        GoogleAuthService strict = serviceWith(new GoogleAuthProperties("id", "secret", List.of(REDIRECT), false));

        assertThatThrownBy(() -> strict.login(command())).isInstanceOf(ConflictException.class);
        assertThat(providers.size()).isZero();
    }

    @Test
    void usernameCollisionsGetANumber() {
        users.create("user", "someone@else.com", hasher.hash("x"));

        service.login(command());

        assertThat(users.findByEmail("user@gmail.com").orElseThrow().username()).isEqualTo("user2");
    }

    @Test
    void anUnverifiedGoogleEmailIsRejected_andNothingIsCreated() {
        identity = new GoogleIdentity("g-1", "user@gmail.com", false, "User", null);

        assertThatThrownBy(() -> service.login(command())).isInstanceOf(InvalidAuthorizationException.class);
        assertThat(users.findByEmail("user@gmail.com")).isEmpty();
    }

    @Test
    void aRedirectUriThatWasNotRegisteredIsRejected() {
        GoogleLoginCommand evil = new GoogleLoginCommand("code", "https://evil.example/cb", "v".repeat(43), "nonce", "1.2.3.4");

        assertThatThrownBy(() -> service.login(evil)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void googleLoginIsUnavailableUntilConfigured() {
        GoogleAuthService off = serviceWith(new GoogleAuthProperties("", "", List.of(REDIRECT), true));

        assertThatThrownBy(() -> off.login(command())).isInstanceOf(ServiceUnavailableException.class);
    }

    @Test
    void aGoogleOnlyAccountCannotLogInWithAPassword() {
        service.login(command());

        assertThatThrownBy(() -> auth.login(new LoginCommand("user", "")))
                .isInstanceOf(InvalidAuthorizationException.class);
    }

    @Test
    void linkingAddsGoogleToTheSignedInUser_withoutCreatingAnyone() {
        User alice = users.create("alice", "alice@example.com", hasher.hash("secret123"));

        LinkedProvider linked = service.link(alice.id(), command());

        assertThat(linked.provider()).isEqualTo("google");
        assertThat(linked.email()).isEqualTo("user@gmail.com");
        assertThat(providers.findUserId("google", "g-1")).contains(alice.id());
        assertThat(users.findByEmail("user@gmail.com")).isEmpty();
        assertThat(service.linkedProviders(alice.id())).hasSize(1);
    }

    @Test
    void linkingDoesNotMergeByEmail_theUserPicksTheAccount() {
        User alice = users.create("alice", "user@gmail.com", hasher.hash("secret123"));
        User bob = users.create("bob", "bob@example.com", hasher.hash("secret123"));

        // Bob links a Google account whose email is Alice's: it becomes Bob's, Alice is untouched.
        service.link(bob.id(), command());

        assertThat(providers.findUserId("google", "g-1")).contains(bob.id());
        assertThat(service.linkedProviders(alice.id())).isEmpty();
    }

    @Test
    void aGoogleAccountLinkedToSomeoneElseCannotBeLinked() {
        User alice = users.create("alice", "alice@example.com", hasher.hash("secret123"));
        User bob = users.create("bob", "bob@example.com", hasher.hash("secret123"));

        service.link(alice.id(), command());

        assertThatThrownBy(() -> service.link(bob.id(), command())).isInstanceOf(ConflictException.class);
        assertThat(service.linkedProviders(bob.id())).isEmpty();
    }

    @Test
    void linkingTheSameAccountTwiceIsHarmless() {
        User alice = users.create("alice", "alice@example.com", hasher.hash("secret123"));

        service.link(alice.id(), command());
        service.link(alice.id(), command());

        assertThat(service.linkedProviders(alice.id())).hasSize(1);
    }

    @Test
    void aSecondDifferentGoogleAccountIsRefusedUntilTheFirstIsUnlinked() {
        User alice = users.create("alice", "alice@example.com", hasher.hash("secret123"));

        service.link(alice.id(), command());
        identity = new GoogleIdentity("g-2", "other@gmail.com", true, "Other", null);

        assertThatThrownBy(() -> service.link(alice.id(), command())).isInstanceOf(ConflictException.class);
    }

    @Test
    void unlinkingRemovesGoogle_whenThereIsAPassword() {
        User alice = users.create("alice", "alice@example.com", hasher.hash("secret123"));

        service.link(alice.id(), command());
        service.unlink(alice.id(), "google");

        assertThat(service.linkedProviders(alice.id())).isEmpty();
        assertThat(providers.findUserId("google", "g-1")).isEmpty();
    }

    @Test
    void unlinkingIsRefusedWhenGoogleIsTheOnlyWayToSignIn() {
        service.login(command());
        UUID id = users.findByEmail("user@gmail.com").orElseThrow().id();

        assertThatThrownBy(() -> service.unlink(id, "google")).isInstanceOf(ConflictException.class);
        assertThat(service.linkedProviders(id)).hasSize(1);
    }

    @Test
    void unlinkingSomethingNotLinkedIsNotFound() {
        User alice = users.create("alice", "alice@example.com", hasher.hash("secret123"));

        assertThatThrownBy(() -> service.unlink(alice.id(), "google")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.unlink(alice.id(), "github")).isInstanceOf(BadRequestException.class);
    }
}
