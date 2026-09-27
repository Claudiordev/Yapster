package com.claudiordese.chat.infrastructure.controller.internal;

import com.claudiordese.chat.application.service.CallPresenceService;
import com.claudiordese.chat.application.service.ChatService;
import com.claudiordese.chat.infrastructure.controller.request.CallParticipantsRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Service-to-service endpoints. Callers are authenticated by the shared secret in
 * {@link com.claudiordese.chat.infrastructure.security.InternalSecretInterceptor}
 * before they get here. Not reachable through the gateway: its routes only map
 * {@code /chat/**} to {@code /api/v1/chat/**}, never to this path.
 */
@RestController
@RequestMapping("${url.api.base-path}/internal/chat")
public class InternalChatController {

    private final ChatService chatService;
    private final CallPresenceService callPresence;

    public InternalChatController(ChatService chatService, CallPresenceService callPresence) {
        this.chatService = chatService;
        this.callPresence = callPresence;
    }

    /** The voice service reports who's in a conversation's call (full list, read from LiveKit).
     * So it's updated back in the call presence to all the users */
    @PutMapping("/conversations/{conversationId}/call-participants")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void callParticipants(@PathVariable UUID conversationId, @RequestBody @Valid CallParticipantsRequest request) {
        callPresence.update(conversationId, request.userIds() == null ? List.of() : request.userIds());
    }

    /** Session reports a profile picture or username change; everyone who shares a chat with them is told. */
    @PostMapping("/users/{userId}/profile-changed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void profileChanged(@PathVariable UUID userId) {
        chatService.sendProfileChanged(userId);
    }

    @PostMapping("/users/{userId}/roles-changed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rolesChanged(@PathVariable UUID userId) {
        chatService.sendRolesChanged(userId);
    }
}
