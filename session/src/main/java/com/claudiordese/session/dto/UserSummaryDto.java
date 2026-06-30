package com.claudiordese.session.dto;

import java.util.UUID;

/** Public view of a user — what *other* users may see. Never email or password. */
public record UserSummaryDto(UUID id, String username, String avatarUrl) {}
