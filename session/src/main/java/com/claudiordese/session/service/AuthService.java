package com.claudiordese.session.service;

import com.claudiordese.exceptions.InterdictedException;
import com.claudiordese.session.dto.LoginRequest;
import com.claudiordese.session.dto.LoginResponse;
import com.claudiordese.session.dto.RegisterResponse;
import com.claudiordese.session.dto.UserDto;
import com.claudiordese.session.entity.User;
import com.claudiordese.session.repository.UserRepository;
import com.claudiordese.session.util.JwtUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
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
                .orElseThrow(() -> new InterdictedException("403", "User not found"));

        if (!passwordEncoder.matches(loginRequest.password(), user.getPassword())) {
            throw new InterdictedException("403", "Password incorrect");
        }
        String jwt = jwtUtils.generateToken(user);

        return new LoginResponse(jwt,"Bearer","3600");
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
}
