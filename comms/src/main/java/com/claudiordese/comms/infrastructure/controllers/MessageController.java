package com.claudiordese.comms.infrastructure.controllers;

import com.claudiordese.comms.application.service.CommsService;
import com.claudiordese.comms.application.service.commands.GetMessageCommand;
import com.claudiordese.comms.application.service.commands.SendMessageCommand;
import com.claudiordese.comms.application.service.result.MessageResult;
import com.claudiordese.comms.infrastructure.controllers.request.SendMessageRequest;
import com.claudiordese.comms.infrastructure.controllers.response.MessageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v1/comms/messages")
public class MessageController {

    private final CommsService commsService;

    public MessageController(CommsService commsService) {
        this.commsService = commsService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse send(@Valid @RequestBody SendMessageRequest request) {
        MessageResult result = commsService.send(
                new SendMessageCommand(currentUsername(), request.receiver(), request.message()));
        return MessageResponse.from(result);
    }

    @GetMapping("/{id}")
    public MessageResponse getById(@NotBlank @PathVariable("id") String id) {
        MessageResult result = commsService.get(
                new GetMessageCommand(UUID.fromString(id), currentUsername()));
        return MessageResponse.from(result);
    }

    private static String currentUsername() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
}
