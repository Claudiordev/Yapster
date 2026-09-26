package com.claudiordese.session.application.domain;

import java.util.UUID;

/** One of a user's GIF folders; the default one is "Favorites". */
public record GifFolder(UUID id, UUID userId, String name, boolean isDefault, int gifCount) {}
