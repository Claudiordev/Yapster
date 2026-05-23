package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.EmailMismatchException;
import com.claudiordese.exceptions.EmailTakenException;
import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.exceptions.NotFound;
import com.claudiordese.exceptions.TokenExpired;
import com.claudiordese.exceptions.TokenRevoked;
import com.claudiordese.exceptions.UsernameTaken;
import com.claudiordese.security.config.JwtSecurityProperties;
import com.claudiordese.session.application.service.commands.LoginCommand;
import com.claudiordese.session.application.service.commands.RegisterCommand;
import com.claudiordese.session.application.port.PasswordHasher;
import com.claudiordese.session.application.port.RefreshTokenStore;
import com.claudiordese.session.application.port.TokenIssuer;
import com.claudiordese.session.application.port.UserStore;
import com.claudiordese.session.application.service.result.LoginResult;
import com.claudiordese.session.application.service.result.RegisterResult;
import com.claudiordese.session.application.domain.IssuedToken;
import com.claudiordese.session.application.domain.RefreshToken;
import com.claudiordese.session.application.domain.User;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class AuthService {

    private final UserStore users;
    private final RefreshTokenStore refreshTokens;
    private final PasswordHasher hasher;
    private final TokenIssuer tokens;
    private final JwtSecurityProperties props;

    public AuthService(UserStore users,
                       RefreshTokenStore refreshTokens,
                       PasswordHasher hasher,
                       TokenIssuer tokens,
                       JwtSecurityProperties props) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.hasher = hasher;
        this.tokens = tokens;
        this.props = props;
    }

    public LoginResult login(LoginCommand command) {
        User user = users.findByUsername(command.username())
                .filter(u -> hasher.matches(command.password(), u.passwordHash()))
                .orElseThrow(() -> new InvalidAuthorizationException(
                        "invalid_credentials", "Invalid username or password"));

        IssuedToken access = tokens.issue(user, accessTtl());
        RefreshToken refresh = refreshTokens.issueFor(user.username(), refreshTtl());
        return new LoginResult(access.accessToken(), refresh.value(), "Bearer", access.expiresInSeconds());
    }

    @Transactional
    public RegisterResult registerUser(RegisterCommand command) {
        if (!command.emailsMatching()) {
            throw new EmailMismatchException("email_mismatch", "Email and confirm email do not match");
        }
        if (users.existsByUsername(command.username())) {
            throw new UsernameTaken("username_taken", "Username is already in use");
        }
        if (users.existsByEmail(command.email())) {
            throw new EmailTakenException("email_taken", "Email is already taken");
        }

        User created = users.create(command.username(), command.email(), hasher.hash(command.password()));
        return new RegisterResult(created.id().toString(), created.username());
    }

    @Transactional
    public LoginResult refreshAccessToken(String refreshTokenStr) {
        RefreshToken existing = refreshTokens.findByValue(refreshTokenStr)
                .orElseThrow(() -> new NotFound("not_found", "Token not found"));

        if (existing.revoked()) {
            throw new TokenRevoked("token_revoked", "Token has been revoked");
        }
        if (existing.isExpired(Instant.now())) {
            refreshTokens.delete(existing);
            throw new TokenExpired("token_expired", "Token has expired");
        }

        User user = users.findByUsername(existing.username())
                .orElseThrow(() -> new NotFound("not_found", "User not found for this token"));

        refreshTokens.delete(existing);

        IssuedToken access = tokens.issue(user, accessTtl());
        RefreshToken rotated = refreshTokens.issueFor(user.username(), refreshTtl());
        return new LoginResult(access.accessToken(), rotated.value(), "Bearer", access.expiresInSeconds());
    }

    @Transactional
    public void logout(String refreshTokenStr) {
        RefreshToken existing = refreshTokens.findByValue(refreshTokenStr)
                .orElseThrow(() -> new NotFound("not_found", "Refresh token not found"));
        refreshTokens.revoke(existing);
    }

    private Duration accessTtl() {
        return Duration.ofMillis(props.getAccessExpirationMs());
    }

    private Duration refreshTtl() {
        return Duration.ofMillis(props.getRefreshExpirationMs());
    }
}
