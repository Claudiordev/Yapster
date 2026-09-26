package com.claudiordese.voice.application.domain.rooms;

/** A published screen-share video track as LiveKit reports it (dimensions are what the publisher declared). */
public record ScreenShareTrack(String sid, int width, int height) {

    /** The smaller side, so a portrait or ultrawide screen counts by its tier (1080p, 1440p...) not its aspect ratio. */
    public int shortSide() {
        return Math.min(width, height);
    }
}
