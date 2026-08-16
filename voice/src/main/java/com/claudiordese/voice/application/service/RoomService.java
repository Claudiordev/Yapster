package com.claudiordese.voice.application.service;

import com.claudiordese.voice.application.domain.rooms.RoomAccess;
import com.claudiordese.voice.application.port.ConversationMembershipVerifier;
import com.claudiordese.voice.application.port.RoomAccessProvider;
import org.springframework.stereotype.Service;

/**
 * Application entry point for joining a voice room.
 */
@Service
public class RoomService {

    private final RoomAccessProvider accessProvider;
    private final ConversationMembershipVerifier membershipVerifier;

    public RoomService(RoomAccessProvider accessProvider, ConversationMembershipVerifier membershipVerifier) {
        this.accessProvider = accessProvider;
        this.membershipVerifier = membershipVerifier;
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
}
