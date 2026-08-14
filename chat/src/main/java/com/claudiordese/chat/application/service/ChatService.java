package com.claudiordese.chat.application.service;

import com.claudiordese.chat.application.domain.chat.Conversation;
import com.claudiordese.chat.application.domain.chat.ConversationSummary;
import com.claudiordese.chat.application.domain.chat.Message;
import com.claudiordese.chat.application.domain.chat.types.ConversationType;
import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.application.domain.event.server.MessageEvent;
import com.claudiordese.chat.application.domain.event.server.TypingEvent;
import com.claudiordese.chat.application.domain.event.server.UserStatusEvent;
import com.claudiordese.chat.application.port.socket.EventGateway;
import com.claudiordese.chat.application.port.persistence.ConversationStore;
import com.claudiordese.chat.application.port.persistence.MessageStore;
import com.claudiordese.exceptions.InterdictedException;
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

    private final MessageStore messages;
    private final ConversationStore conversations;
    private final EventGateway events;

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
                           Instant.now()));

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
                        Instant.now()
                )
        );

        conversations.addMember(groupConversation.id(),creator);
        for (UUID member : members) {
            conversations.addMember(groupConversation.id(), member);
        }

        return groupConversation;
    }

    @Transactional
    public Message sendMessage(UUID conversationId, UUID senderId, String body) {
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
}
