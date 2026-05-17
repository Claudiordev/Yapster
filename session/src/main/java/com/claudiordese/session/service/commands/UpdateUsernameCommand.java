package com.claudiordese.session.service.commands;

import java.util.UUID;

public record UpdateUsernameCommand(UUID userId, String newUsername) {}
