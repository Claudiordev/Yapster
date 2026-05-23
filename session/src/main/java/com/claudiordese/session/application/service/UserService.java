package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.InvalidAuthorizationException;
import com.claudiordese.exceptions.NotFound;
import com.claudiordese.exceptions.UsernameTaken;
import com.claudiordese.session.application.service.commands.UpdatePasswordCommand;
import com.claudiordese.session.application.service.commands.UpdateUsernameCommand;
import com.claudiordese.session.application.domain.User;
import com.claudiordese.session.application.port.PasswordHasher;
import com.claudiordese.session.application.port.UserStore;
import com.claudiordese.session.dto.UserDto;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserStore users;
    private final PasswordHasher hasher;

    public UserDto getUserById(UUID id) {
        User user = users.findById(id)
                .orElseThrow(() -> new NotFound("not_found", "User not found"));
        return new UserDto(user.id(), user.username());
    }

    public BigDecimal getBalanceById(UUID id) {
        User user = users.findById(id)
                .orElseThrow(() -> new NotFound("not_found", "User not found"));
        return user.balance();
    }

    @Transactional
    public void updateUsername(UpdateUsernameCommand command) {
        User user = users.findById(command.userId())
                .orElseThrow(() -> new NotFound("not_found", "User not found"));

        if (users.existsByUsername(command.newUsername())) {
            throw new UsernameTaken("username_taken", "Username is already in use");
        }

        users.update(user.withUsername(command.newUsername()));
    }

    @Transactional
    public void updatePassword(UpdatePasswordCommand command) {
        User user = users.findById(command.userId())
                .orElseThrow(() -> new NotFound("not_found", "User not found"));

        if (!hasher.matches(command.currentPassword(), user.passwordHash())) {
            throw new InvalidAuthorizationException("invalid_credentials", "Current password is incorrect");
        }

        users.update(user.withPasswordHash(hasher.hash(command.newPassword())));
    }
}
