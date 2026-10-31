package com.claudiordese.chat.application.domain.chat;

import java.util.List;

public record MessageWithReactions(Message message, List<ReactionSummary> reactions) {}
