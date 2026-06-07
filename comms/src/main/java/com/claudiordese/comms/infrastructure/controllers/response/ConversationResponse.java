package com.claudiordese.comms.infrastructure.controllers.response;

import com.claudiordese.comms.application.domain.Conversation;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "All messages exchanged with one recipient, oldest first.")
public record ConversationResponse(

        @Schema(description = "Recipient phone number in E.164 format.", example = "+14155552671")
        String receiver,

        @Schema(description = "Messages, oldest first.")
        List<MessageItemResponse> messages) {

    public static ConversationResponse from(Conversation c) {
        return new ConversationResponse(
                c.receiver(),
                c.messages().stream().map(MessageItemResponse::from).toList());
    }
}
