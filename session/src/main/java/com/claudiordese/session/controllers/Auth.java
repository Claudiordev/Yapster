package com.claudiordese.session.controllers;

import com.claudiordese.session.dto.LoginRequest;
import com.claudiordese.session.dto.LoginResponse;
import com.claudiordese.session.dto.UserDto;
import com.claudiordese.session.service.AuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/auth")
public class Auth {

    private final AuthService authService;

    @PostMapping
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest loginRequest) throws RuntimeException {
        LoginResponse loginResponse = authService.login(loginRequest);
        return ResponseEntity.ok(loginResponse);
    }

    @GetMapping("/user/{id}")
    public ResponseEntity<?> forgotUsername(@NotBlank @PathVariable("id") String userId) {
        UserDto userDto = authService.getUserById(UUID.fromString(userId));
        return ResponseEntity.ok(userDto);
    }

    @PutMapping("/user/{id}")
    public ResponseEntity<?> updateUsername(@NotBlank @PathVariable("id") String userId, @Valid @RequestParam String newUsername) {
        return ResponseEntity.ok(authService.updateUsername(UUID.fromString(userId), newUsername));
    }
}
