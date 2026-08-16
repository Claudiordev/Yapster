package com.claudiordese.chat.infrastructure.controller;

import com.claudiordese.chat.application.service.ChatService;
import com.claudiordese.chat.infrastructure.controller.request.AddMemberRequest;
import com.claudiordese.chat.infrastructure.controller.request.CreateGroupRequest;
import com.claudiordese.chat.infrastructure.controller.request.MarkReadRequest;
import com.claudiordese.chat.infrastructure.controller.request.SendMessageRequest;
import com.claudiordese.chat.infrastructure.controller.request.StartDmRequest;
import com.claudiordese.chat.infrastructure.controller.responses.ConversationResponse;
import com.claudiordese.chat.infrastructure.controller.responses.ConversationSummaryResponse;
import com.claudiordese.chat.infrastructure.controller.responses.MemberView;
import com.claudiordese.chat.infrastructure.controller.responses.MessageResponse;
import com.claudiordese.exceptions.InterdictedException;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("${url.api.base-path}/chat")
@AllArgsConstructor
public class ChatController {

    private ChatService chatService;

    @PostMapping("/dm")
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationResponse createDm(@RequestBody StartDmRequest request, Authentication auth) {
        return ConversationResponse.of(
                chatService.startDm(
                        loggedUser(auth),
                        request.recipientUserId()
                ));
    }

    @PostMapping("/group")
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationResponse createGroup(@RequestBody @Valid CreateGroupRequest request, Authentication auth) {
        return ConversationResponse.of(
                chatService.createGroup(
                        loggedUser(auth),
                        request.groupName(),
                        request.memberIds()
                ));
    }

    @PostMapping("/{conversationId}/members")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addMember(@PathVariable UUID conversationId, @RequestBody @Valid AddMemberRequest request, Authentication auth) {
        chatService.addMember(conversationId, loggedUser(auth), request.memberId());
    }

    @DeleteMapping("/{conversationId}/members/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@PathVariable UUID conversationId, @PathVariable UUID memberId, Authentication auth) {
        chatService.removeMember(conversationId, loggedUser(auth), memberId);
    }

    @DeleteMapping("/{conversationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGroup(@PathVariable UUID conversationId, Authentication auth) {
        chatService.deleteGroup(conversationId, loggedUser(auth));
    }

    @GetMapping("/conversations")
    public List<ConversationSummaryResponse> conversations(Authentication auth) {
        return chatService.listConversationSummaries(loggedUser(auth)).stream().map(
                conversationSummary -> {
                    return new ConversationSummaryResponse(
                            conversationSummary.conversation().id(),
                            conversationSummary.conversation().type().name(),
                            conversationSummary.conversation().name(),
                            conversationSummary.conversation().creatorId(),
                            conversationSummary.recipientsIds().stream().map(userId -> new MemberView(userId, conversationSummary.recipientsStatus().get(userId))).toList(),
                            conversationSummary.message().body(),
                            conversationSummary.message().sentAt(),
                            conversationSummary.message().seq(),
                            conversationSummary.lastReadSeq(),
                            conversationSummary.unreadCount());
                }
        ).toList();
    }

    @PostMapping("/{conversationId}/message")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse sendMessage(@PathVariable UUID conversationId, @RequestBody @Valid SendMessageRequest sendMessageRequest, Authentication auth) {
        return MessageResponse.of(
                chatService.sendMessage(
                        conversationId,
                        loggedUser(auth),
                        sendMessageRequest.body()
                )
        );
    }

    @GetMapping("/{conversationId}/message")
    public List<MessageResponse> getMessages(@PathVariable UUID conversationId,
                                             @RequestParam(defaultValue = "9223372036854775807") long beforeSeq,
                                             @RequestParam(defaultValue = "20") int limit,
                                             Authentication auth) {
        return chatService.history(conversationId,
                loggedUser(auth),
                beforeSeq,
                limit).stream().map(MessageResponse::of).toList();
    }

    @PostMapping("/{conversationId}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(@PathVariable UUID conversationId, @RequestBody MarkReadRequest markReadRequest, Authentication auth) {
        chatService.markRead(conversationId,
                loggedUser(auth),
                markReadRequest.seq());
    }

    /**
     * Yes/no membership check consumed by other services (voice, to
     * authorize joining a call room named after the conversation) -- not
     * meant for the browser.
     */
    @GetMapping("/{conversationId}/membership")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void checkMembership(@PathVariable UUID conversationId, Authentication auth) {
        if (!chatService.isMember(conversationId, loggedUser(auth))) {
            throw new InterdictedException("not_a_member", "Not a member of this conversation");
        }
    }


    /**
     * @return Parsed JWT UUID String to same UUID Object
     */
    private static UUID loggedUser(Authentication a) {
        return UUID.fromString(a.getName());
    }
}
