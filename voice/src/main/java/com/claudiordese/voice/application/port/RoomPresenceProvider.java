package com.claudiordese.voice.application.port;

import java.util.List;

/** Reads who is connected to a media room right now. */
public interface RoomPresenceProvider {

    /** Identities (user ids) currently connected to {@code room}. */
    List<String> participantIdentities(String room);
}
