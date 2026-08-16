package com.claudiordese.voice.application.port;

/**
 * Checks whether a user belongs to a conversation before they're allowed to
 * join the voice room named after it -- rooms are 1:1 with chat conversations,
 * so this is what stops anyone with a valid session JWT from joining anyone
 * else's DM or group call by guessing the conversation id.
 */
public interface ConversationMembershipVerifier {

    /**
     * @param conversationId    the room being joined; matches a chat conversation id
     * @param authorizationHeader the caller's own "Bearer <token>" header, forwarded as-is
     * @throws com.claudiordese.exceptions.ForbiddenException if the caller isn't a member
     */
    void verifyMember(String conversationId, String authorizationHeader);
}
