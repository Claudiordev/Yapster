package com.claudiordese.chat.infrastructure.controller.request;

import java.util.UUID;

public record StartDmRequest(UUID recipientUserId) {}
