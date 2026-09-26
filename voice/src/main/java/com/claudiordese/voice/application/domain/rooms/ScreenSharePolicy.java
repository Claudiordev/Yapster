package com.claudiordese.voice.application.domain.rooms;

import java.util.Collection;

/** Highest screen-share resolution a set of roles may publish. Mirrors web/lib/mediaPrefs.ts. */
public final class ScreenSharePolicy {

    public static final int BASE = 1080;
    public static final int QHD = 1440;
    public static final int UHD = 2160;

    private ScreenSharePolicy() {}

    /** 2160p: PREMIUM_PLUS, MODERATOR, ADMIN. 1440p: PREMIUM. Everyone else 1080p. */
    public static int maxHeight(Collection<String> roles) {
        if (roles.contains("ADMIN") || roles.contains("MODERATOR") || roles.contains("PREMIUM_PLUS")) return UHD;
        if (roles.contains("PREMIUM")) return QHD;
        return BASE;
    }
}
