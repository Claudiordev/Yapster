package com.claudiordese.session.application.service.commands;

import java.util.UUID;

public record UpdateBioCommand(UUID userId, String bio) {}
