package com.claudiordese.session.service;

import com.claudiordese.exceptions.*;
import com.claudiordese.security.config.JwtSecurityProperties;
import com.claudiordese.session.dto.LoginRequest;
import com.claudiordese.session.dto.TokenResponse;
import com.claudiordese.session.dto.RegisterResponse;
import com.claudiordese.session.dto.UserDto;
import com.claudiordese.session.entity.RefreshToken;
import com.claudiordese.session.entity.User;
import com.claudiordese.session.repository.RefreshTokenRepository;
import com.claudiordese.session.repository.UserRepository;
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

    public TokenResponse login(LoginRequest loginRequest) throws RuntimeException {
        User user = userRepository.findByUsername(loginRequest.username())
                .orElseThrow(() -> new NotFound("not_found", "User not found"));

        if (!passwordEncoder.matches(loginRequest.password(), user.getPassword())) {
            throw new InterdictedException("invalid_credentials", "Incorrect username or password");
        }
        String jwt = jwtUtils.generateToken(user,jwtSecurityProperties.getAccessExpirationMs());
        RefreshToken refreshToken = createRefreshToken(user.getUsername());

        return new TokenResponse(jwt, refreshToken.getToken(), "Bearer", jwtSecurityProperties.getAccessExpirationMs());
    }

    @Transactional
    public RegisterResponse addUser(LoginRequest loginRequest) throws UsernameTaken{
        if (userRepository.findByUsername(loginRequest.username()).isPresent()) {
            throw new UsernameTaken("username_taken", "Username is already in use");
        }

        String encodedPassword = passwordEncoder.encode(loginRequest.password());

        User user = new User();
        user.setUsername(loginRequest.username());
        user.setPassword(encodedPassword);

        userRepository.save(user);

        return new RegisterResponse(user.getId().toString());
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
        RefreshToken oldToken = verifyRefreshToken(refreshTokenStr);
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

    private RefreshToken verifyRefreshToken(String token) throws NotFound {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new NotFound("not_found", "Token not found"));

        if (refreshToken.isRevoked()) {
            throw new TokenRevoked("token_revoked", "Token has been revoked");
        }

        if (refreshToken.getExpiryDate().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new TokenExpired("token_expired", "Token has expired");
        }

        return refreshToken;
    }
}
