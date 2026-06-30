package com.claudiordese.voice.application.service;

import com.claudiordese.voice.application.domain.RoomAccess;
import com.claudiordese.voice.application.port.RoomAccessProvider;
import org.springframework.stereotype.Service;

/**
 * Application entry point for joining a voice room.
 */
@Service
public class RoomService {

    private final RoomAccessProvider accessProvider;

    public RoomService(RoomAccessProvider accessProvider) {
        this.accessProvider = accessProvider;
    }

    /**
     * @param identity the authenticated caller (JWT subject / user id)
     * @param room requested room name
     */
    public RoomAccess join(String identity, String room) {
        String normalized = room == null ? "" : room.strip();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("room must not be blank");
        }
        return accessProvider.accessFor(identity, normalized);
    }
}
