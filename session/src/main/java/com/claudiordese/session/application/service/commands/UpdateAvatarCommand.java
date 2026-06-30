package com.claudiordese.session.application.service.commands;

import java.util.UUID;

/** Raw uploaded image bytes + its content type — the storage layer turns it into a URL. */
public record UpdateAvatarCommand(UUID userId, byte[] content, String contentType) {}
