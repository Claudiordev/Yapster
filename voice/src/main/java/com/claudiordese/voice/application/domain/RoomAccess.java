package com.claudiordese.voice.application.domain;

/**
 * Everything a client needs to join a voice room on the media server: where to
 * connect ({@code serverUrl}), a signed access {@code token} scoped to one room
 * and identity, and the echoed {@code room}/{@code identity} for convenience.
 */
public record RoomAccess(String serverUrl, String token, String room, String identity) {
}
