package com.claudiordese.voice.application.service;

import com.claudiordese.voice.application.domain.rooms.RoomAccess;
import com.claudiordese.voice.application.port.ConversationMembershipVerifier;
import com.claudiordese.voice.application.port.RoomAccessProvider;
import com.claudiordese.voice.application.port.RoomPresenceProvider;
import com.claudiordese.voice.application.domain.rooms.RoomStatus;
import com.claudiordese.voice.infrastructure.adapter.chat.ChatClient;
import com.claudiordese.voice.infrastructure.configurations.InternalProperties;
import org.springframework.stereotype.Service;

/**
 * Application entry point for joining a voice room.
 */
@Service
public class RoomService {

    private final RoomAccessProvider accessProvider;
    private final ConversationMembershipVerifier membershipVerifier;
    private final RoomPresenceProvider presenceProvider;
    private final ChatClient chatClient;
    private final InternalProperties internalProperties;

    public RoomService(RoomAccessProvider accessProvider,
                       ConversationMembershipVerifier membershipVerifier,
                       RoomPresenceProvider presenceProvider,
                       ChatClient chatClient,
                       InternalProperties internalProperties) {
        this.accessProvider = accessProvider;
        this.membershipVerifier = membershipVerifier;
        this.presenceProvider = presenceProvider;
        this.chatClient = chatClient;
        this.internalProperties = internalProperties;
    }

    /**
     * @param identity the authenticated caller (JWT subject / user id)
     * @param room requested room name -- always a chat conversation id, DM or group alike
     * @param authorizationHeader the caller's own bearer token, forwarded to chat to verify membership
     */
    public RoomAccess join(String identity, String room, String authorizationHeader) {
        String normalized = room == null ? "" : room.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("room must not be blank");
        }

        membershipVerifier.verifyMember(normalized, authorizationHeader);

        return accessProvider.accessFor(identity, normalized);
    }

    public RoomStatus status(String room, String authorizationHeader) {
        String normalized = room == null ? "" : room.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("room must not be blank");
        }

        membershipVerifier.verifyMember(normalized, authorizationHeader);
        int count = presenceProvider.participantCount(normalized);
        return new RoomStatus(normalized, count > 0, count);
    }

    public void publishStatus(String room) {
        int count = presenceProvider.participantCount(room);
        chatClient.publishCallStatus(
                internalProperties.secret(),
                new ChatClient.CallStatusPayload(room, count > 0, count));
    }

    public void publishEmptyStatus(String room) {
        chatClient.publishCallStatus(
                internalProperties.secret(),
                new ChatClient.CallStatusPayload(room, false, 0));
    }
}
