package com.claudiordese.session.service;

import com.claudiordese.exceptions.InterdictedException;
import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.session.dto.LoginRequest;
import com.claudiordese.session.dto.LoginResponse;
import com.claudiordese.session.dto.RegisterResponse;
import com.claudiordese.session.dto.UserDto;
import com.claudiordese.session.entity.RefreshToken;
import com.claudiordese.session.entity.User;
import com.claudiordese.session.repository.RefreshTokenRepository;
import com.claudiordese.session.repository.UserRepository;
import com.claudiordese.session.util.JwtUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtUtils jwtUtils;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    @Value("${jwt.refreshExpirationMs}")
    private Long refreshExpirationMs;

    public AuthService(UserRepository userRepository, RefreshTokenRepository refreshTokenRepository, JwtUtils jwtUtils, PasswordEncoder passwordEncoder, ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtUtils = jwtUtils;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = objectMapper;
    }

    public LoginResponse login(LoginRequest loginRequest) throws RuntimeException {
        User user = userRepository.findByUsername(loginRequest.username())
                .orElseThrow(() -> new InterdictedException("403", "User not found"));

        if (!passwordEncoder.matches(loginRequest.password(), user.getPassword())) {
            throw new InterdictedException("403", "Password incorrect");
        }
        String jwt = jwtUtils.generateToken(user);
        RefreshToken refreshToken = createRefreshToken(user.getUsername());

        return new LoginResponse(jwt, refreshToken.getToken(), "Bearer", jwtUtils.getAccessExpirationSeconds());
    }

    @Transactional
    public RegisterResponse addUser(LoginRequest loginRequest) {
        if (userRepository.findByUsername(loginRequest.username()).isPresent()) {
            throw new InterdictedException("409", "Username already present");
        }

        String encodedPassword = passwordEncoder.encode(loginRequest.password());

        User user = new User();
        user.setUsername(loginRequest.username());
        user.setPassword(encodedPassword);

        userRepository.save(user);

        return new RegisterResponse(user.getId().toString());
    }

    public UserDto getUserById(UUID id) throws InterdictedException {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new InterdictedException("403", "User not found"));

        return objectMapper.convertValue(user, UserDto.class);
    }

    public boolean updateUsername(UUID id, String newUsername) throws InterdictedException {
        try {
            User user = userRepository.findById(id)
                    .orElseThrow(() -> new InterdictedException("403", "User not found"));
            user.setUsername(newUsername);
            userRepository.save(user);

            return true;
        } catch (IllegalArgumentException e) {
            throw new InterdictedException("403", "User not found");
        }
    }

    @Transactional
    public LoginResponse refreshAccessToken(String refreshTokenStr) {
        RefreshToken oldToken = verifyRefreshToken(refreshTokenStr);
        String username = oldToken.getUsername();

        refreshTokenRepository.delete(oldToken);

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new InterdictedException("403", "User not found"));

        String newAccessToken = jwtUtils.generateToken(user);
        RefreshToken newRefreshToken = createRefreshToken(username);

        return new LoginResponse(newAccessToken, newRefreshToken.getToken(), "Bearer", jwtUtils.getAccessExpirationSeconds());
    }

    @Transactional
    public void logout(String refreshTokenStr) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(refreshTokenStr)
                .orElseThrow(() -> new InvalidAuthorizationException("401", "Refresh token not found"));
        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);
    }

    private RefreshToken createRefreshToken(String username) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken(UUID.randomUUID().toString());
        refreshToken.setUsername(username);
        refreshToken.setExpiryDate(Instant.now().plusMillis(refreshExpirationMs));
        refreshToken.setRevoked(false);
        return refreshTokenRepository.save(refreshToken);
    }

    private RefreshToken verifyRefreshToken(String token) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new InvalidAuthorizationException("401", "Refresh token not found"));

        if (refreshToken.isRevoked()) {
            throw new InvalidAuthorizationException("401", "Refresh token has been revoked");
        }

        if (refreshToken.getExpiryDate().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new InvalidAuthorizationException("401", "Refresh token has expired");
        }

        return refreshToken;
    }
}
