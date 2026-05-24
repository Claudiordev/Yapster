package com.claudiordese.comms.infrastructure.controllers;

import com.claudiordese.comms.application.domain.Conversation;
import com.claudiordese.comms.application.service.CommsService;
import com.claudiordese.comms.application.service.commands.GetMessageCommand;
import com.claudiordese.comms.application.service.commands.SendMessageCommand;
import com.claudiordese.comms.application.service.result.MessageResult;
import com.claudiordese.comms.infrastructure.controllers.request.SendMessageRequest;
import com.claudiordese.comms.infrastructure.controllers.response.ConversationResponse;
import com.claudiordese.comms.infrastructure.controllers.response.MessageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.annotation.Secured;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@Tag(name = "Messages", description = "Send SMS messages and inspect past conversations.")
@Validated
@RestController
@RequestMapping("/api/v1/messages")
public class MessageController {

    private final CommsService commsService;

    public MessageController(CommsService commsService) {
        this.commsService = commsService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Send an SMS",
            description = """
                    Hands the message off to the configured SMS provider (Twilio) and
                    persists an audit row asynchronously. The response returns the moment
                    the provider has *accepted* the message — the eventual delivery status
                    is captured separately when the audit log is written.
                    """)
    @ApiResponse(responseCode = "201", description = "Provider accepted the message; an audit row will be persisted in the background.")
    @ApiResponse(responseCode = "400", description = "Request body failed validation.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "401", description = "Missing or invalid JWT.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "503", description = "Provider rejected the request or is unreachable.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public MessageResponse send(@Valid @RequestBody SendMessageRequest request, Principal principal) {
        MessageResult result = commsService.send(new SendMessageCommand(
                principal.getName(), request.receiver(), request.message()));

        return MessageResponse.from(result);
    }

    @GetMapping
    @Operation(
            summary = "List the caller's conversations",
            description = """
                    Returns every recipient the caller has texted, each with the messages
                    they exchanged, oldest first. Recipients are ordered by the caller's
                    first contact with them.
                    """)
    @ApiResponse(responseCode = "200", description = "Conversations grouped by recipient.")
    @ApiResponse(responseCode = "401", description = "Missing or invalid JWT.", content = @Content(schema = @Schema(implementation = ProblemDetail.class)))
    public List<ConversationResponse> conversations(Principal principal) {
        List<Conversation> conversations = commsService.conversationsFor(principal.getName());

        return conversations.stream().map(ConversationResponse::from).toList();
    }

    @GetMapping("/{id}")
    @ApiResponse(responseCode = "200", description = "Return updated message")
    @PreAuthorize("hasRole('ADMIN')")
    public MessageResult message(@PathVariable String id) {
        return commsService.getMessage(new GetMessageCommand(id));
    }
}
