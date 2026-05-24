package com.claudiordese.comms.controllers;

import com.claudiordese.comms.dto.SendMessageRequest;
import com.claudiordese.comms.service.CommsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/comms/messages")
public class MessageController {

    private final CommsService commsService;

    @PostMapping
    public ResponseEntity<?> send(@Valid @RequestBody SendMessageRequest request) {
        return ResponseEntity.ok(commsService.sendMessage(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@NotBlank @PathVariable("id") String id) {
        return ResponseEntity.ok(commsService.getMessage(id));
    }
}
