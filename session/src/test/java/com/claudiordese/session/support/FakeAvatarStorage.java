package com.claudiordese.session.support;

import com.claudiordese.session.application.port.AvatarStorage;

import java.util.UUID;

/** Returns a deterministic URL without touching object storage. */
public class FakeAvatarStorage implements AvatarStorage {

    @Override
    public String store(UUID userId, byte[] content, String contentType) {
        return "https://cdn.test/avatars/" + userId + extension(contentType);
    }

    private static String extension(String contentType) {
        return "image/png".equals(contentType) ? ".png" : "";
    }
}
