package com.claudiordese.session.application.service.commands;

import java.util.UUID;

public record UpdatePasswordCommand(UUID userId, String currentPassword, String newPassword) {}
