package com.claudiordese.session.application.port;

import java.util.UUID;

/** Stores avatar images in object storage and returns a publicly reachable URL. */
public interface AvatarStorage {

    /**
     * Store the avatar bytes for a user and return the URL to serve it from.
     * The bytes and content type come from the upload; the implementation
     * decides the object key and how the URL is formed.
     */
    String store(UUID userId, byte[] content, String contentType);
}
