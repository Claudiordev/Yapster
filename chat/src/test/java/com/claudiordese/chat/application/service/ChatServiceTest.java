package com.claudiordese.chat.application.service;

import com.claudiordese.chat.application.config.MessageRateLimitPolicy;
import com.claudiordese.chat.application.domain.chat.Conversation;
import com.claudiordese.chat.application.domain.chat.ConversationMember;
import com.claudiordese.chat.application.domain.chat.Message;
import com.claudiordese.chat.application.domain.chat.types.ConversationType;
import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.application.domain.event.server.ServerEvent;
import com.claudiordese.chat.application.port.persistence.ConversationStore;
import com.claudiordese.chat.application.port.persistence.MessageStore;
import com.claudiordese.chat.application.port.socket.EventGateway;
import com.claudiordese.chat.support.InMemoryRateLimitGuard;
import com.claudiordese.exceptions.TooManyRequestsException;
import com.claudiordese.exceptions.InterdictedException;
import com.claudiordese.exceptions.NotFound;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChatServiceTest {

    private InMemoryConversationStore conversations;
    private ChatService service;

    @BeforeEach
    void setUp() {
        conversations = new InMemoryConversationStore();
        service = new ChatService(
                new InMemoryMessageStore(),
                conversations,
                new NoOpEventGateway(),
                new InMemoryRateLimitGuard(),
                new MessageRateLimitPolicy(20, Duration.ofSeconds(10)));
    }

    @Test
    void sendMessage_throwsTooManyRequests_afterTwentyMessagesForSenderAndConversation() {
        // Arrange
        UUID conversationId = UUID.randomUUID();
        UUID senderId = UUID.randomUUID();
        conversations.members = List.of(senderId);

        for (int message = 0; message < 20; message++) {
            assertThatCode(() -> service.sendMessage(conversationId, senderId, "hello"))
                    .doesNotThrowAnyException();
        }

        // Act + Assert
        assertThatThrownBy(() -> service.sendMessage(conversationId, senderId, "one too many"))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessage("Too many messages. Please try again later");

        UUID anotherConversationId = UUID.randomUUID();
        assertThatCode(() -> service.sendMessage(anotherConversationId, senderId, "different conversation"))
                .doesNotThrowAnyException();
    }

    @Test
    void verifyCanModerateCall_allowsGroupCreator() {
        UUID conversationId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, creatorId));
        conversations.members = List.of(creatorId, targetId);

        assertThatCode(() -> service.verifyCanModerateCall(
                conversationId, creatorId, targetId, false))
                .doesNotThrowAnyException();
    }

    @Test
    void verifyCanModerateCall_allowsPlatformAdminWhoIsMember() {
        UUID conversationId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, creatorId));
        conversations.members = List.of(creatorId, adminId, targetId);

        assertThatCode(() -> service.verifyCanModerateCall(
                conversationId, adminId, targetId, true))
                .doesNotThrowAnyException();
    }

    @Test
    void verifyCanModerateCall_rejectsOrdinaryMember() {
        UUID conversationId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, creatorId));
        conversations.members = List.of(creatorId, memberId, targetId);

        assertThatThrownBy(() -> service.verifyCanModerateCall(
                conversationId, memberId, targetId, false))
                .isInstanceOf(InterdictedException.class)
                .hasMessage("Only the group creator or a platform administrator can moderate this call");
    }

    @Test
    void verifyCanModerateCall_rejectsTargetOutsideConversation() {
        UUID conversationId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, creatorId));
        conversations.members = List.of(creatorId);

        assertThatThrownBy(() -> service.verifyCanModerateCall(
                conversationId, creatorId, targetId, false))
                .isInstanceOf(NotFound.class)
                .hasMessage("Target user is not a member of this conversation");
    }

    private static Conversation group(UUID id, UUID creatorId) {
        return new Conversation(
                id,
                ConversationType.GROUP,
                "Group",
                null,
                Instant.now(),
                creatorId);
    }

    private static final class InMemoryMessageStore implements MessageStore {

        private final List<Message> messages = new ArrayList<>();

        @Override
        public Message saveMessage(Message message) {
            messages.add(message);
            return message;
        }

        @Override
        public List<Message> history(UUID conversationId, long beforeSeq, int limit) {
            return messages.stream()
                    .filter(message -> message.conversationId().equals(conversationId))
                    .limit(limit)
                    .toList();
        }

        @Override
        public Optional<Message> latest(UUID conversationId) {
            return messages.stream()
                    .filter(message -> message.conversationId().equals(conversationId))
                    .reduce((first, second) -> second);
        }

        @Override
        public long countSince(UUID conversationId, long lastReadSeq) {
            return messages.stream()
                    .filter(message -> message.conversationId().equals(conversationId))
                    .filter(message -> message.seq() > lastReadSeq)
                    .count();
        }
    }

    private static final class InMemoryConversationStore implements ConversationStore {

        private List<UUID> members = List.of();
        private Optional<Conversation> conversation = Optional.empty();

        @Override
        public List<UUID> membersOf(UUID conversationId) {
            return members;
        }

        @Override
        public boolean isMember(UUID conversationId, UUID userId) {
            return members.contains(userId);
        }

        @Override
        public Conversation create(Conversation conversation) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<Conversation> findById(UUID id) {
            return conversation.filter(candidate -> candidate.id().equals(id));
        }

        @Override
        public Optional<Conversation> findByDmKey(String dmKey) {
            return Optional.empty();
        }

        @Override
        public List<Conversation> findForUser(UUID userId) {
            return List.of();
        }

        @Override
        public ConversationMember addMember(UUID conversationId, UUID userId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void removeMember(UUID conversationId, UUID userId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void delete(UUID conversationId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public long lastReadSeq(UUID conversationId, UUID userId) {
            return 0;
        }

        @Override
        public void markRead(UUID conversationId, UUID userId, long seq) {
            throw new UnsupportedOperationException();
        }
    }

    private static final class NoOpEventGateway implements EventGateway {

        @Override
        public boolean isOnline(String userId) {
            return false;
        }

        @Override
        public void send(String userId, ServerEvent event) {
        }

        @Override
        public boolean setStatus(String userId, UserStatusType status) {
            return false;
        }

        @Override
        public UserStatusType statusOf(String userId) {
            return UserStatusType.OFFLINE;
        }

        @Override
        public int onlineUsers() {
            return 0;
        }

        @Override
        public int onlineDevices() {
            return 0;
        }
    }
}
