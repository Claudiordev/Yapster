package com.claudiordese.session.application.service.commands;

import java.util.UUID;

public record CreateServerCommand(UUID ownerId, String name) {}
