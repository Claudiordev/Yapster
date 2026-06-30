package com.claudiordese.session.application.service.commands;

import java.util.UUID;

public record AddServerMemberCommand(UUID serverId, UUID requesterId, UUID userIdToAdd) {}
