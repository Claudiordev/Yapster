package com.claudiordese.session.application.domain;

import java.util.Set;

/** What a user's roles allow in their GIF library. Limits are enforced here, never just in the UI. */
public final class GifLibraryPolicy {

    /** Hosts a saved GIF may point at (rendered in other people's chats, so it must not be arbitrary). */
    public static final Set<String> ALLOWED_HOSTS = Set.of("static.klipy.com");

    private GifLibraryPolicy() {}

    /** Folders beyond the default Favorites. */
    public static int maxExtraFolders(Set<String> roles) {
        if (isTopTier(roles)) return 20;
        if (roles.contains("PREMIUM")) return 5;
        return 0;
    }

    /** Distinct GIFs saved across all folders. */
    public static int maxGifs(Set<String> roles) {
        if (isTopTier(roles)) return 1000;
        if (roles.contains("PREMIUM")) return 300;
        return 100;
    }

    private static boolean isTopTier(Set<String> roles) {
        return roles.contains("ADMIN") || roles.contains("MODERATOR") || roles.contains("PREMIUM_PLUS");
    }
}
