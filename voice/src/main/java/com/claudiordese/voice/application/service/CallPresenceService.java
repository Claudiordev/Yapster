package com.claudiordese.voice.application.service;

import com.claudiordese.voice.application.port.RoomPresenceProvider;
import com.claudiordese.voice.infrastructure.adapter.chat.ChatClient;
import com.claudiordese.voice.infrastructure.configurations.InternalProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Tells chat who is in a conversation's call. The room name IS the conversation id.
 *
 * On every LiveKit webhook the whole current list is re-read from LiveKit (never
 * built from individual join/leave events, which can arrive out of order) and sent
 * to chat, which stores it and pushes it to the conversation's members. Failures
 * are logged and swallowed: the webhook must still answer 200 so LiveKit doesn't
 * retry, and the next event resends the full list anyway.
 */
@Service
public class CallPresenceService {

    private static final Logger log = LoggerFactory.getLogger(CallPresenceService.class);

    private final RoomPresenceProvider presence;
    private final ChatClient chat;
    private final InternalProperties internal;

    public CallPresenceService(RoomPresenceProvider presence, ChatClient chat, InternalProperties internal) {
        this.presence = presence;
        this.chat = chat;
        this.internal = internal;
    }

    /** Re-read the room from LiveKit and publish the full list. */
    public void publish(String room) {
        if (!isConversationId(room)) return;

        try {
            List<String> userIds = presence.participantIdentities(room).stream()
                    .filter(CallPresenceService::isConversationId)
                    .distinct()
                    .toList();

            chat.publishCallParticipants(room, internal.secret(), new ChatClient.CallParticipantsPayload(userIds));
        } catch (RuntimeException e) {
            log.warn("Could not publish call participants for {}: {}", room, e.getMessage());
        }
    }

    /** The room is gone (LiveKit may already have dropped it), so the list is empty. */
    public void publishEmpty(String room) {
        if (!isConversationId(room)) return;

        try {
            chat.publishCallParticipants(room, internal.secret(), new ChatClient.CallParticipantsPayload(List.of()));
        } catch (RuntimeException e) {
            log.warn("Could not clear call participants for {}: {}", room, e.getMessage());
        }
    }

    /** Rooms are conversation ids and identities are user ids; both are UUIDs. */
    private static boolean isConversationId(String value) {
        try {
            UUID.fromString(value);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
