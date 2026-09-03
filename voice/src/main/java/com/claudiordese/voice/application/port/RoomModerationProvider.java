package com.claudiordese.voice.application.port;

/** Administrative media operations applied to everyone in a LiveKit room. */
public interface RoomModerationProvider {

    void muteMicrophone(String room, String participantIdentity);
}
