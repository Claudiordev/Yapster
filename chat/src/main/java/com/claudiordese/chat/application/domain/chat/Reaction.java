package com.claudiordese.chat.application.domain.chat;

import java.time.Instant;
import java.util.UUID;

public record Reaction(
        UUID messageId,
        UUID userId,
        String emoji, // unified hex codepoints of the emoji, e.g. "1f44d" for 👍 or "2764-fe0f" for ❤️
        Instant createdAt) {}
