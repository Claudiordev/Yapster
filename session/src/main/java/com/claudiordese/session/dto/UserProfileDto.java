package com.claudiordese.session.dto;

import java.util.List;
import java.util.UUID;

/** Public profile card for a single user — what *other* users may see. Never email or password. */
public record UserProfileDto(UUID id, String username, String avatarUrl, List<String> roles, String bio) {}
