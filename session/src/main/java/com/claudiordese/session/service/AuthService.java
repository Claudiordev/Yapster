package com.claudiordese.session.service;

import com.claudiordese.exceptions.*;
import com.claudiordese.security.config.JwtSecurityProperties;
import com.claudiordese.session.controllers.response.TokenResponse;
import com.claudiordese.session.dto.UserDto;
import com.claudiordese.session.entity.RefreshToken;
import com.claudiordese.session.entity.User;
import com.claudiordese.session.repository.RefreshTokenRepository;
import com.claudiordese.session.repository.UserRepository;
import com.claudiordese.session.service.commands.LoginCommand;
import com.claudiordese.session.service.commands.RegisterCommand;
import com.claudiordese.session.service.result.LoginResult;
import com.claudiordese.session.service.result.RegisterResult;
import com.claudiordese.session.util.JwtUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtUtils jwtUtils;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;
    private final JwtSecurityProperties jwtSecurityProperties;

    public AuthService(UserRepository userRepository, RefreshTokenRepository refreshTokenRepository, JwtUtils jwtUtils, PasswordEncoder passwordEncoder, ObjectMapper objectMapper, JwtSecurityProperties jwtSecurityProperties) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtUtils = jwtUtils;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = objectMapper;
        this.jwtSecurityProperties = jwtSecurityProperties;
    }

    public LoginResult login(LoginCommand loginCommand) throws RuntimeException {
        User user = userRepository.findByUsername(loginCommand.username())
                .orElseThrow(() -> new NotFound("not_found", "User not found"));

        if (!passwordEncoder.matches(loginCommand.password(), user.getPassword())) {
            throw new InterdictedException("invalid_credentials", "Incorrect username or password");
        }
        String jwt = jwtUtils.generateToken(user,jwtSecurityProperties.getAccessExpirationMs());
        RefreshToken refreshToken = createRefreshToken(user.getUsername());

        return new LoginResult(jwt, refreshToken.getToken(), "Bearer", jwtSecurityProperties.getAccessExpirationMs());
    }

    @Transactional
    public RegisterResult registerUser(RegisterCommand registerCommand) throws UsernameTaken{
        if (userRepository.findByUsername(registerCommand.username()).isPresent()) {
            throw new UsernameTaken("username_taken", "Username is already in use");
        }

        if (!registerCommand.emailsMatching()) {
            throw new EmailMismatchException("email_mismatch", "Email and confirm email do not match");
        }

        if (userRepository.findByEmail(registerCommand.email()).isPresent()) {
            throw new EmailTakenException("email_taken", "Email is already taken");
        }

        String encodedPassword = passwordEncoder.encode(registerCommand.password());

        User user = new User();
        user.setUsername(registerCommand.username());
        user.setEmail(registerCommand.email());
        user.setPassword(encodedPassword);

        userRepository.save(user);

        return new RegisterResult(
                user.getId().toString(),
                user.getUsername());
    }

    public BigDecimal getBalanceByUsername(String username) throws NotFound{
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFound("not_found", "User not found"));
        return user.getBalance();
    }

    public UserDto getUserById(UUID id) throws NotFound {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new NotFound("not_found", "User not found"));

        return objectMapper.convertValue(user, UserDto.class);
    }

    public boolean updateUsername(UUID id, String newUsername) throws NotFound {
        try {
            User user = userRepository.findById(id).orElseThrow(() -> new NotFound("not_found", "User not found"));
            user.setUsername(newUsername);
            userRepository.save(user);


            return true;
        } catch (RuntimeException e) {
            throw new NotFound("not_found", "User not found");
        }
    }

    @Transactional
    public TokenResponse refreshAccessToken(String refreshTokenStr) throws NotFound {
        RefreshToken oldToken = jwtUtils.verifyRefreshToken(refreshTokenStr);
        String username = oldToken.getUsername();

        refreshTokenRepository.delete(oldToken);

        User user = userRepository.findByUsername(username).orElseThrow(() -> new NotFound("not_found", "User not found for this token"));

        String newAccessToken = jwtUtils.generateToken(user,jwtSecurityProperties.getRefreshExpirationMs());
        RefreshToken newRefreshToken = createRefreshToken(username);

        return new TokenResponse(newAccessToken, newRefreshToken.getToken(), "Bearer", jwtSecurityProperties.getRefreshExpirationMs());
    }

    @Transactional
    public void logout(String refreshTokenStr) throws NotFound{
        RefreshToken refreshToken = refreshTokenRepository.findByToken(refreshTokenStr).orElseThrow(() -> new NotFound("not_found", "Refresh token not found"));
        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);
    }

    private RefreshToken createRefreshToken(String username) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken(UUID.randomUUID().toString());
        refreshToken.setUsername(username);
        refreshToken.setExpiryDate(Instant.now().plusMillis(jwtSecurityProperties.getRefreshExpirationMs()));
        refreshToken.setRevoked(false);
        return refreshTokenRepository.save(refreshToken);
    }
}
