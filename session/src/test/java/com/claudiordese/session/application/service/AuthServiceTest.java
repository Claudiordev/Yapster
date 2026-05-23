package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.EmailMismatchException;
import com.claudiordese.exceptions.EmailTakenException;
import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.exceptions.NotFound;
import com.claudiordese.exceptions.UsernameTaken;
import com.claudiordese.security.config.JwtSecurityProperties;
import com.claudiordese.session.application.port.PasswordHasher;
import com.claudiordese.session.application.port.RefreshTokenStore;
import com.claudiordese.session.application.port.TokenIssuer;
import com.claudiordese.session.application.port.UserStore;
import com.claudiordese.session.application.service.commands.LoginCommand;
import com.claudiordese.session.application.service.commands.RegisterCommand;
import com.claudiordese.session.application.service.result.LoginResult;
import com.claudiordese.session.application.service.result.RegisterResult;
import com.claudiordese.session.support.FakeTokenIssuer;
import com.claudiordese.session.support.InMemoryRefreshTokenStore;
import com.claudiordese.session.support.InMemoryUserStore;
import com.claudiordese.session.support.PlainTextPasswordHasher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthServiceTest {

    private UserStore users;
    private RefreshTokenStore refreshTokens;
    private PasswordHasher hasher;
    private TokenIssuer tokens;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        users = new InMemoryUserStore();
        refreshTokens = new InMemoryRefreshTokenStore();
        hasher = new PlainTextPasswordHasher();
        tokens = new FakeTokenIssuer();

        JwtSecurityProperties props = new JwtSecurityProperties();
        props.setAccessExpirationMs(900_000L);       // 15 min
        props.setRefreshExpirationMs(2_592_000_000L); // 30 days

        authService = new AuthService(users, refreshTokens, hasher, tokens, props);
    }

    // ─── login ──────────────────────────────────────────────────────────

    @Test
    void login_returnsTokenPair_whenCredentialsAreValid() {
        // Arrange
        users.create("alice", "alice@example.com", hasher.hash("secret123"));

        // Act
        LoginResult result = authService.login(new LoginCommand("alice", "secret123"));

        // Assert
        assertThat(result.accessToken()).startsWith("fake-jwt-");
        assertThat(result.refreshToken()).isNotBlank();
        assertThat(result.tokenType()).isEqualTo("Bearer");
        assertThat(result.expiresIn()).isEqualTo(900L);
        assertThat(refreshTokens.findByValue(result.refreshToken())).isPresent();
    }

    @Test
    void login_throwsInvalidAuth_whenUsernameDoesNotExist() {
        // Arrange — no user created

        // Act + Assert
        assertThatThrownBy(() -> authService.login(new LoginCommand("ghost", "any")))
                .isInstanceOf(InvalidAuthorizationException.class)
                .hasMessage("Invalid username or password");
    }

    @Test
    void login_throwsInvalidAuth_whenPasswordIsWrong() {
        // Arrange
        users.create("alice", "alice@example.com", hasher.hash("secret123"));

        // Act + Assert
        assertThatThrownBy(() -> authService.login(new LoginCommand("alice", "wrong")))
                .isInstanceOf(InvalidAuthorizationException.class)
                .hasMessage("Invalid username or password");
    }

    // ─── register ───────────────────────────────────────────────────────

    @Test
    void registerUser_createsUser_andReturnsRegisterResult() {
        // Arrange
        RegisterCommand cmd = new RegisterCommand(
                "alice",
                "alice@example.com",
                "alice@example.com",
                "secret123");

        // Act
        RegisterResult result = authService.registerUser(cmd);

        // Assert
        assertThat(result.id()).isNotBlank();
        assertThat(result.username()).isEqualTo("alice");

        // verify side effect: user is now persisted
        assertThat(users.findByUsername("alice")).isPresent();
        assertThat(users.findByUsername("alice").get().passwordHash())
                .isEqualTo("hashed:secret123");
    }

    @Test
    void registerUser_throwsEmailMismatch_whenEmailsDontMatch() {
        // Arrange
        RegisterCommand cmd = new RegisterCommand(
                "alice",
                "alice@example.com",
                "different@example.com",
                "secret123");

        // Act + Assert
        assertThatThrownBy(() -> authService.registerUser(cmd))
                .isInstanceOf(EmailMismatchException.class);
        assertThat(users.findByUsername("alice")).isEmpty();
    }

    @Test
    void registerUser_throwsUsernameTaken_whenUsernameAlreadyExists() {
        // Arrange
        users.create("alice", "first@example.com", hasher.hash("secret123"));

        RegisterCommand cmd = new RegisterCommand(
                "alice",
                "second@example.com",
                "second@example.com",
                "anotherpass");

        // Act + Assert
        assertThatThrownBy(() -> authService.registerUser(cmd))
                .isInstanceOf(UsernameTaken.class);
    }

    @Test
    void registerUser_throwsEmailTaken_whenEmailAlreadyExists() {
        // Arrange
        users.create("first", "shared@example.com", hasher.hash("secret123"));

        RegisterCommand cmd = new RegisterCommand(
                "second",
                "shared@example.com",
                "shared@example.com",
                "anotherpass");

        // Act + Assert
        assertThatThrownBy(() -> authService.registerUser(cmd))
                .isInstanceOf(EmailTakenException.class);
    }

    // ─── refresh ────────────────────────────────────────────────────────

    @Test
    void refreshAccessToken_rotatesTokens_whenRefreshTokenIsValid() {
        // Arrange
        users.create("alice", "alice@example.com", hasher.hash("secret123"));
        LoginResult initial = authService.login(new LoginCommand("alice", "secret123"));

        // Act
        LoginResult refreshed = authService.refreshAccessToken(initial.refreshToken());

        // Assert
        assertThat(refreshed.accessToken()).isNotEqualTo(initial.accessToken());
        assertThat(refreshed.refreshToken()).isNotEqualTo(initial.refreshToken());
        // old refresh token is deleted, new one issued
        assertThat(refreshTokens.findByValue(initial.refreshToken())).isEmpty();
        assertThat(refreshTokens.findByValue(refreshed.refreshToken())).isPresent();
    }

    @Test
    void refreshAccessToken_throwsNotFound_whenRefreshTokenUnknown() {
        // Arrange — no token issued

        // Act + Assert
        assertThatThrownBy(() -> authService.refreshAccessToken("never-issued"))
                .isInstanceOf(NotFound.class);
    }

    // ─── logout ─────────────────────────────────────────────────────────

    @Test
    void logout_revokesRefreshToken() {
        // Arrange
        users.create("alice", "alice@example.com", hasher.hash("secret123"));
        LoginResult login = authService.login(new LoginCommand("alice", "secret123"));

        // Act
        authService.logout(login.refreshToken());

        // Assert
        assertThat(refreshTokens.findByValue(login.refreshToken()))
                .isPresent()
                .get()
                .satisfies(t -> assertThat(t.revoked()).isTrue());
    }
}
