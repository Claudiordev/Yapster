package com.claudiordese.session.application.service.commands;

import java.util.UUID;

public record UpdateUsernameCommand(UUID userId, String newUsername) {}
