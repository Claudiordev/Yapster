package com.claudiordese.comms.application.service.commands;

import java.util.UUID;

public record GetMessageCommand(UUID messageId, String requester) {}
