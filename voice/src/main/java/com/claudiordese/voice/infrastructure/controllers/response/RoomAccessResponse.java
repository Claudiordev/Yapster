package com.claudiordese.voice.infrastructure.controllers.response;

import com.claudiordese.voice.application.domain.RoomAccess;

/**
 * Response to the LiveKit SDK: {@code room.connect(serverUrl, token)}.
 */
public record RoomAccessResponse(String serverUrl, String token, String room, String identity) {

    public static RoomAccessResponse from(RoomAccess access) {
        return new RoomAccessResponse(access.serverUrl(), access.token(), access.room(), access.identity());
    }
}
