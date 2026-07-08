package com.claudiordese.voice.application.port;

import com.claudiordese.voice.application.domain.rooms.RoomAccess;

/**
 * Produces the credentials a peer needs to join a real-time voice room.
 */
public interface RoomAccessProvider {

    /**
     * Grant {@code identity} permission to join {@code room}.
     *
     * @param identity the authenticated user id (becomes the participant identity)
     * @param room     the room to join; created on demand by the media server
     * @return connection info including a short-lived, room-scoped token
     */
    RoomAccess accessFor(String identity, String room);
}
