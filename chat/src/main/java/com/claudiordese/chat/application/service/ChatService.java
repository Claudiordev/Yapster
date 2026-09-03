package com.claudiordese.chat.application.service;

import com.claudiordese.chat.application.config.MessageRateLimitPolicy;
import com.claudiordese.chat.application.domain.chat.Conversation;
import com.claudiordese.chat.application.domain.chat.ConversationSummary;
import com.claudiordese.chat.application.domain.chat.Message;
import com.claudiordese.chat.application.domain.chat.types.ConversationType;
import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.application.domain.event.server.CallEndedEvent;
import com.claudiordese.chat.application.domain.event.server.CallStatusEvent;
import com.claudiordese.chat.application.domain.event.server.CallStartedEvent;
import com.claudiordese.chat.application.domain.event.server.MessageEvent;
import com.claudiordese.chat.application.domain.event.server.TypingEvent;
import com.claudiordese.chat.application.domain.event.server.UserStatusEvent;
import com.claudiordese.chat.application.port.socket.EventGateway;
import com.claudiordese.chat.application.port.persistence.ConversationStore;
import com.claudiordese.chat.application.port.persistence.MessageStore;
import com.claudiordese.chat.application.port.ratelimit.RateLimitGuard;
import com.claudiordese.exceptions.BadRequestException;
import com.claudiordese.exceptions.ConflictException;
import com.claudiordese.exceptions.InterdictedException;
import com.claudiordese.exceptions.NotFound;
import com.claudiordese.exceptions.TooManyRequestsException;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@AllArgsConstructor
public class ChatService {

    /** Creator + this many others. */
    private static final int MAX_GROUP_SIZE = 15;

    private final MessageStore messages;
    private final ConversationStore conversations;
    private final EventGateway events;
    private final RateLimitGuard rateLimitGuard;
    private final MessageRateLimitPolicy messageRateLimitPolicy;

    @Transactional
    public Conversation startDm(UUID a, UUID b) {
        String key = dmKey(a, b);

        return conversations.findByDmKey(key).orElseGet(() -> {
           Conversation dm = conversations.create(
                   new Conversation(
                           UUID.randomUUID(),
                           ConversationType.DM,
                           null,
                           key,
                           Instant.now(),
                           a));

                   conversations.addMember(dm.id(), a);
                   conversations.addMember(dm.id(), b);

                   return dm;
        });
    }

    @Transactional
    public Conversation createGroup(UUID creator, String name, Set<UUID> members) {
        Conversation groupConversation = conversations.create(
                new Conversation(
                        UUID.randomUUID(),
                        ConversationType.GROUP,
                        name,
                        null,
                        Instant.now(),
                        creator
                )
        );

        conversations.addMember(groupConversation.id(),creator);
        for (UUID member : members) {
            conversations.addMember(groupConversation.id(), member);
        }

        return groupConversation;
    }

    @Transactional
    public void addMember(UUID conversationId, UUID requesterId, UUID newMemberId) {
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> new NotFound("not_found", "Conversation not found"));

        if (conversation.type() != ConversationType.GROUP) {
            throw new BadRequestException("not_a_group", "Members can only be added to a group conversation");
        }

        List<UUID> members = conversations.membersOf(conversationId);

        if (!members.contains(requesterId)) {
            throw new InterdictedException("not_a_member", "Not a member of this conversation");
        }

        if (members.contains(newMemberId)) {
            throw new ConflictException("already_member", "User is already a member of this group");
        }

        if (members.size() >= MAX_GROUP_SIZE) {
            throw new BadRequestException("group_full", "Group already has the maximum of " + MAX_GROUP_SIZE + " members");
        }

        conversations.addMember(conversationId, newMemberId);
    }

    @Transactional
    public void removeMember(UUID conversationId, UUID requesterId, UUID targetUserId) {
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> new NotFound("not_found", "Conversation not found"));

        if (conversation.type() != ConversationType.GROUP) {
            throw new BadRequestException("not_a_group", "Members can only be removed from a group conversation");
        }

        if (!requesterId.equals(conversation.creatorId())) {
            throw new InterdictedException("not_creator", "Only the creator of this group can remove members");
        }

        if (targetUserId.equals(conversation.creatorId())) {
            throw new BadRequestException("cannot_remove_creator", "The creator can't be removed from the group -- delete it instead");
        }

        if (!conversations.isMember(conversationId, targetUserId)) {
            throw new NotFound("not_a_member", "That user is not a member of this group");
        }

        conversations.removeMember(conversationId, targetUserId);
    }

    @Transactional
    public void deleteGroup(UUID conversationId, UUID requesterId) {
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> new NotFound("not_found", "Conversation not found"));

        if (conversation.type() != ConversationType.GROUP) {
            throw new BadRequestException("not_a_group", "Only group conversations can be deleted this way");
        }

        if (!requesterId.equals(conversation.creatorId())) {
            throw new InterdictedException("not_creator", "Only the creator of this group can delete it");
        }

        conversations.delete(conversationId);
    }

    public void verifyCanModerateCall(
            UUID conversationId,
            UUID requesterId,
            UUID targetUserId,
            boolean platformAdmin) {
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> new NotFound("not_found", "Conversation not found"));
        List<UUID> members = conversations.membersOf(conversationId);

        if (!members.contains(requesterId)) {
            throw new InterdictedException("not_a_member", "Not a member of this conversation");
        }
        if (!members.contains(targetUserId)) {
            throw new NotFound("target_not_a_member", "Target user is not a member of this conversation");
        }
        if (requesterId.equals(targetUserId)) {
            throw new BadRequestException("cannot_moderate_self", "Use your own call controls to mute yourself");
        }

        boolean isGroupCreator = conversation.type() == ConversationType.GROUP
                && requesterId.equals(conversation.creatorId());
        if (!platformAdmin && !isGroupCreator) {
            throw new InterdictedException(
                    "not_call_moderator",
                    "Only the group creator or a platform administrator can moderate this call");
        }
    }

    @Transactional
    public Message sendMessage(UUID conversationId, UUID senderId, String body) {
        if (!rateLimitGuard.tryConsume(
                "message:" + senderId + ":" + conversationId,
                messageRateLimitPolicy.maxAttempts(),
                messageRateLimitPolicy.window())) {
            throw new TooManyRequestsException(
                    "message_rate_limit_exceeded",
                    "Too many messages. Please try again later");
        }

        List<UUID> members = conversations.membersOf(conversationId);

        if (!members.contains(senderId)) {
            throw new InterdictedException("not_a_member", "Not a member of this conversation");
        }

        Message newMessage = messages.saveMessage(
                new Message(UUID.randomUUID(), conversationId, senderId, body, Instant.now(), 0L)
        );

        MessageEvent messageEvent = new MessageEvent(newMessage.id().toString(), newMessage.seq(), conversationId.toString(), senderId.toString(), body, newMessage.sentAt());

        for (UUID m : members) {
            events.send(m.toString(), messageEvent);
        }

        return newMessage;
    }

    public void sendTyping(UUID conversationId, UUID senderId) {
        List<UUID> members = conversations.membersOf(conversationId);

        if (!members.contains(senderId)) {
            throw new InterdictedException("not_a_member", "Not a member of this conversation");
        }

        TypingEvent typingEvent = new TypingEvent(conversationId.toString(), senderId.toString());

        for (UUID m : members) {
            if (!m.equals(senderId)) events.send(m.toString(), typingEvent);
        }
    }

    public void sendCallStarted(UUID conversationId, UUID senderId) {
        List<UUID> members = conversations.membersOf(conversationId);

        if (!members.contains(senderId)) {
            throw new InterdictedException("not_a_member", "Not a member of this conversation");
        }

        CallStartedEvent event = new CallStartedEvent(conversationId.toString(), senderId.toString());

        for (UUID m : members) {
            if (!m.equals(senderId)) events.send(m.toString(), event);
        }
    }

    public void sendCallEnded(UUID conversationId, UUID senderId) {
        List<UUID> members = conversations.membersOf(conversationId);

        if (!members.contains(senderId)) {
            throw new InterdictedException("not_a_member", "Not a member of this conversation");
        }

        CallEndedEvent event = new CallEndedEvent(conversationId.toString(), senderId.toString());

        for (UUID m : members) {
            if (!m.equals(senderId)) events.send(m.toString(), event);
        }
    }

    public void sendCallStatus(UUID conversationId, boolean ongoing, int participantCount) {
        List<UUID> members = conversations.membersOf(conversationId);
        CallStatusEvent event = new CallStatusEvent(
                conversationId.toString(), ongoing, Math.max(0, participantCount));

        for (UUID member : members) {
            events.send(member.toString(), event);
        }
    }

    public void sendUserStatus(UUID senderId, UserStatusType userStatusType) {
        if(userStatusType != UserStatusType.OFFLINE && !events.setStatus(senderId.toString(), userStatusType)) return;

        UserStatusEvent event = new UserStatusEvent(senderId.toString(), userStatusType);

        conversations.findForUser(senderId).stream()
                .flatMap(c -> conversations.membersOf(c.id()).stream())
                .distinct()
                .filter(user -> !user.equals(senderId))
                .forEach(user -> events.send(user.toString(),event));
    }

    public List<Conversation> listConversations(UUID userId) {
        return conversations.findForUser(userId);
    }


    public List<Message> history(UUID conv, UUID loggedUser, long beforeSeq, int limit) {
        if (!conversations.isMember(conv, loggedUser)) {
            throw new InterdictedException("not_a_member", "Not a member of this conversation history");
        }

        return messages.history(conv,beforeSeq,limit);
    }

    /**
     * Used by other services (e.g. voice, to authorize joining a call room
     * named after the conversation) that only need a yes/no membership check.
     */
    public boolean isMember(UUID conversationId, UUID userId) {
        return conversations.isMember(conversationId, userId);
    }

    public List<ConversationSummary> listConversationSummaries(UUID loggedUser) {
        return conversations.findForUser(loggedUser).stream().map( conversation -> {
            Message message = messages.history(conversation.id(), Long.MAX_VALUE, 1).stream().findFirst().orElseGet(() ->
                    new Message(UUID.randomUUID(), conversation.id(),loggedUser,"", Instant.now(), 0L)
            );

            List<UUID> recipientsIds = conversations.membersOf(conversation.id()).stream().filter(member -> !member.equals(loggedUser)).toList();
            Map<UUID, UserStatusType> usersStatus = recipientsIds.stream().collect(Collectors.toMap(userId -> userId, userId -> events.statusOf(userId.toString())));

            long lastReadSeq = conversations.lastReadSeq(conversation.id(), loggedUser);
            long unreadCount = messages.countSince(conversation.id(), lastReadSeq);
            return new ConversationSummary(
                    conversation,
                    recipientsIds,
                    usersStatus,
                    message,
                    lastReadSeq,
                    unreadCount);
        }).toList();
    }

    public void markRead(UUID conv, UUID loggedUser, long seq) {
        conversations.markRead(conv, loggedUser, seq);
    }

    private static String dmKey(UUID a, UUID b) {
        return a.compareTo(b) < 0 ? a + ":" + b : b + ":" + a;
    }

    public int getOnlineUsers() {
        return events.onlineUsers();
    }

    public int getOnlineDevices() {
        return events.onlineDevices();
    }
}
