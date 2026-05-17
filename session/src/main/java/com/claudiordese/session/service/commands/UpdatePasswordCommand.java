package com.claudiordese.session.service.commands;

import java.util.UUID;

public record UpdatePasswordCommand(UUID userId, String currentPassword, String newPassword) {}
