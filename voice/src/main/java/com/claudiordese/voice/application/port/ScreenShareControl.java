package com.claudiordese.voice.application.port;

import com.claudiordese.voice.application.domain.rooms.ScreenShareTrack;

import java.util.List;

/** Reads and stops screen shares on the media server. Media itself never passes through this service. */
public interface ScreenShareControl {

    List<String> activeRooms();

    /** The participant's screen-share tracks; empty when they are not in the room. */
    List<ScreenShareTrack> screenSharesOf(String room, String identity);

    /** Stops the track from being forwarded to viewers. */
    void suspend(String room, String identity, String trackSid);
}
