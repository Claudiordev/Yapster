package com.claudiordese.session.service;

import com.claudiordese.session.dto.LoginRequest;
import com.claudiordese.session.dto.LoginResponse;
import com.claudiordese.session.dto.UserDto;
import com.claudiordese.session.entity.User;
import com.claudiordese.session.exceptions.AuthenticationException;
import com.claudiordese.session.repository.UserRepository;
import com.claudiordese.session.util.JwtUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final JwtUtils jwtUtils;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    public AuthService(UserRepository userRepository, JwtUtils jwtUtils, PasswordEncoder passwordEncoder, ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.jwtUtils = jwtUtils;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = objectMapper;
    }

    public LoginResponse login(LoginRequest loginRequest) {
        User user = userRepository.findByUsername(loginRequest.username())
                .orElseThrow(() -> new AuthenticationException("403", "User not found"));

        if (!passwordEncoder.matches(loginRequest.password(), user.getPassword())) {
            throw new AuthenticationException("403", "Password incorrect");
        }
        String jwt = jwtUtils.generateToken(user.getUsername());

        return new LoginResponse(jwt, user.getUsername());
    }

    public UserDto getUserById(UUID id) throws AuthenticationException {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new AuthenticationException("403", "User not found"));

        return objectMapper.convertValue(user, UserDto.class);
    }

    public boolean updateUsername(UUID id, String newUsername) throws AuthenticationException {
        try {
            User user = userRepository.findById(id)
                    .orElseThrow(() -> new AuthenticationException("403", "User not found"));
            user.setUsername(newUsername);
            userRepository.save(user);

            return true;
        } catch (IllegalArgumentException e) {
            throw new AuthenticationException("403", "User not found");
        }
    }
}
