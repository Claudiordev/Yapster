package com.claudiordese.chat.application.service;

import com.claudiordese.chat.application.domain.chat.Conversation;
import com.claudiordese.chat.application.domain.chat.ConversationSummary;
import com.claudiordese.chat.application.domain.chat.Message;
import com.claudiordese.chat.application.domain.chat.types.ConversationType;
import com.claudiordese.chat.application.domain.event.MessageEvent;
import com.claudiordese.chat.application.port.socket.EventGateway;
import com.claudiordese.chat.application.port.persistence.ConversationStore;
import com.claudiordese.chat.application.port.persistence.MessageStore;
import com.claudiordese.exceptions.InterdictedException;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

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

    public Message sendMessage(UUID conversationId, UUID senderId, String body) {
        if (!conversations.isMember(conversationId, senderId)) {
            throw new InterdictedException("not_a_member", "Not a member of this conversation");
        }

        Message newMessage = messages.saveMessage(
                new Message(UUID.randomUUID(), conversationId, senderId, body, Instant.now(), 0L)
        );

        MessageEvent messageEvent = new MessageEvent(newMessage.id().toString(), newMessage.seq(), conversationId.toString(), senderId.toString(), body, newMessage.sentAt());

        for (UUID m : conversations.membersOf(conversationId)) {
            events.send(m.toString(), messageEvent);
        }

        return newMessage;
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

            long lastReadSeq = conversations.lastReadSeq(conversation.id(), loggedUser);
            long unreadCount = messages.countSince(conversation.id(), lastReadSeq);
            return new ConversationSummary(
                    conversation,
                    recipientsIds,
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
