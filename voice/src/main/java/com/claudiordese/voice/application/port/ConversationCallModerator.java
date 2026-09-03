package com.claudiordese.voice.application.port;

/** Verifies that a caller may moderate another participant in a conversation call. */
public interface ConversationCallModerator {

    void verifyCanModerate(
            String conversationId,
            String targetUserId,
            String authorizationHeader);
}
