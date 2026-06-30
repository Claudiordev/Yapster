package com.claudiordese.session.dto;

import java.util.UUID;

public record UserDto(UUID id, String username, String avatarUrl) {}
