package com.claudiordese.session.dto;

import java.util.List;
import java.util.UUID;

public record UserDto(UUID id, String username, String avatarUrl, List<String> roles) {}
