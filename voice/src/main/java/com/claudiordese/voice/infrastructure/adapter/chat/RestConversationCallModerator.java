package com.claudiordese.voice.infrastructure.adapter.chat;

import com.claudiordese.exceptions.ForbiddenException;
import com.claudiordese.voice.application.port.ConversationCallModerator;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;

@Component
public class RestConversationCallModerator implements ConversationCallModerator {

    private final ChatClient chatClient;

    public RestConversationCallModerator(ChatClient chatClient) {
        this.chatClient = chatClient;
    }

    @Override
    public void verifyCanModerate(
            String conversationId,
            String targetUserId,
            String authorizationHeader) {
        try {
            chatClient.checkCallModeration(conversationId, targetUserId, authorizationHeader);
        } catch (RestClientResponseException error) {
            throw new ForbiddenException(
                    "not_call_moderator",
                    "Only the group creator or a platform administrator can moderate this call");
        }
    }
}
