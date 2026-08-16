package com.claudiordese.voice.infrastructure.adapter.chat;

import com.claudiordese.exceptions.ForbiddenException;
import com.claudiordese.voice.application.port.ConversationMembershipVerifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;

@Component
public class RestChatMembershipVerifier implements ConversationMembershipVerifier {

    private final ChatClient chatClient;

    public RestChatMembershipVerifier(ChatClient chatClient) {
        this.chatClient = chatClient;
    }

    @Override
    public void verifyMember(String conversationId, String authorizationHeader) {
        try {
            chatClient.checkMembership(conversationId, authorizationHeader);
        } catch (RestClientResponseException e) {
            // Covers chat's 403 (not a member), 404 (no such conversation), and any
            // other non-2xx -- none of those mean "let them join this call".
            throw new ForbiddenException("not_a_member", "Not a member of this conversation");
        }
    }
}
