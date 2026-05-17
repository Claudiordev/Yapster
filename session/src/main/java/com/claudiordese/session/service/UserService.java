package com.claudiordese.session.service;

import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.exceptions.NotFound;
import com.claudiordese.exceptions.UsernameTaken;
import com.claudiordese.session.dto.UserDto;
import com.claudiordese.session.entity.User;
import com.claudiordese.session.repository.UserRepository;
import com.claudiordese.session.service.commands.UpdatePasswordCommand;
import com.claudiordese.session.service.commands.UpdateUsernameCommand;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserDto getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new NotFound("not_found", "User not found"));
        return new UserDto(user.getId(), user.getUsername());
    }

    public BigDecimal getBalanceById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new NotFound("not_found", "User not found"));
        return user.getBalance();
    }

    @Transactional
    public void updateUsername(UpdateUsernameCommand command) {
        User user = userRepository.findById(command.userId())
                .orElseThrow(() -> new NotFound("not_found", "User not found"));

        if (userRepository.findByUsername(command.newUsername()).isPresent()) {
            throw new UsernameTaken("username_taken", "Username is already in use");
        }

        user.setUsername(command.newUsername());
    }

    @Transactional
    public void updatePassword(UpdatePasswordCommand command) {
        User user = userRepository.findById(command.userId())
                .orElseThrow(() -> new NotFound("not_found", "User not found"));

        if (!passwordEncoder.matches(command.currentPassword(), user.getPassword())) {
            throw new InvalidAuthorizationException("invalid_credentials", "Current password is incorrect");
        }

        user.setPassword(passwordEncoder.encode(command.newPassword()));
    }
}
