package com.claudiordese.chat.application.service;

import com.claudiordese.chat.application.config.MessageRateLimitPolicy;
import com.claudiordese.chat.application.domain.chat.Conversation;
import com.claudiordese.chat.application.domain.chat.ConversationMember;
import com.claudiordese.chat.application.domain.chat.Message;
import com.claudiordese.chat.application.domain.chat.types.ConversationType;
import com.claudiordese.chat.application.domain.chat.types.MessageType;
import com.claudiordese.chat.application.domain.chat.types.SystemEvent;
import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.application.domain.event.server.MembersChangedEvent;
import com.claudiordese.chat.application.domain.event.server.MessageEvent;
import com.claudiordese.chat.application.domain.event.server.ProfileChangedEvent;
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
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChatServiceTest {

    private InMemoryConversationStore conversations;
    private InMemoryMessageStore messageStore;
    private NoOpEventGateway gateway;
    private ChatService service;

    @BeforeEach
    void setUp() {
        conversations = new InMemoryConversationStore();
        messageStore = new InMemoryMessageStore();
        gateway = new NoOpEventGateway();
        service = new ChatService(
                messageStore,
                conversations,
                gateway,
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
    void addMember_postsSystemMessageToEveryoneIncludingNewMember() {
        UUID conversationId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        UUID newMemberId = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, creatorId));
        conversations.members = List.of(creatorId);

        service.addMember(conversationId, creatorId, newMemberId);

        assertThat(messageStore.messages).singleElement().satisfies(message -> {
            assertThat(message.type()).isEqualTo(MessageType.SYSTEM);
            assertThat(message.systemEvent()).isEqualTo(SystemEvent.MEMBER_ADDED);
            assertThat(message.senderId()).isNull();
            assertThat(message.subjectId()).isEqualTo(newMemberId);
        });
        assertThat(gateway.recipientsOf(MessageEvent.class))
                .containsExactlyInAnyOrder(creatorId.toString(), newMemberId.toString());
    }

    @Test
    void removeMember_postsSystemMessageToRemainingMembersOnly() {
        UUID conversationId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, creatorId));
        conversations.members = List.of(creatorId, targetId);

        service.removeMember(conversationId, creatorId, targetId);

        assertThat(messageStore.messages).singleElement().satisfies(message -> {
            assertThat(message.type()).isEqualTo(MessageType.SYSTEM);
            assertThat(message.systemEvent()).isEqualTo(SystemEvent.MEMBER_REMOVED);
            assertThat(message.subjectId()).isEqualTo(targetId);
        });
        assertThat(gateway.recipientsOf(MessageEvent.class)).containsExactly(creatorId.toString());
    }

    @Test
    void addMember_tellsEveryoneTheMembersChanged() {
        UUID conversationId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        UUID newMemberId = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, creatorId));
        conversations.members = List.of(creatorId);

        service.addMember(conversationId, creatorId, newMemberId);

        assertThat(gateway.recipientsOf(MembersChangedEvent.class))
                .containsExactlyInAnyOrder(creatorId.toString(), newMemberId.toString());
        assertThat(gateway.events).filteredOn(MembersChangedEvent.class::isInstance)
                .allSatisfy(event -> assertThat(((MembersChangedEvent) event).getConversationId())
                        .isEqualTo(conversationId.toString()));
    }

    @Test
    void removeMember_tellsTheRemovedUserToo_soTheirClientDropsTheGroup() {
        UUID conversationId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, creatorId));
        conversations.members = List.of(creatorId, targetId);

        service.removeMember(conversationId, creatorId, targetId);

        assertThat(gateway.recipientsOf(MembersChangedEvent.class))
                .containsExactlyInAnyOrder(creatorId.toString(), targetId.toString());
        // ...but they are not told inside the thread.
        assertThat(gateway.recipientsOf(MessageEvent.class)).containsExactly(creatorId.toString());
    }

    @Test
    void leaveGroup_removesTheMember_tellsTheOthersInTheThread_andTheirOwnClientToo() {
        UUID conversationId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        UUID leaverId = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, creatorId));
        conversations.members = List.of(creatorId, leaverId);

        service.leaveGroup(conversationId, leaverId);

        assertThat(conversations.members).containsExactly(creatorId);
        assertThat(messageStore.messages).singleElement().satisfies(message -> {
            assertThat(message.type()).isEqualTo(MessageType.SYSTEM);
            assertThat(message.systemEvent()).isEqualTo(SystemEvent.MEMBER_LEFT);
            assertThat(message.subjectId()).isEqualTo(leaverId);
        });
        assertThat(gateway.recipientsOf(MessageEvent.class)).containsExactly(creatorId.toString());
        assertThat(gateway.recipientsOf(MembersChangedEvent.class))
                .containsExactlyInAnyOrder(creatorId.toString(), leaverId.toString());
    }

    @Test
    void leaveGroup_rejectsTheCreator_whoShouldDeleteInstead() {
        UUID conversationId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, creatorId));
        conversations.members = List.of(creatorId, UUID.randomUUID());

        assertThatThrownBy(() -> service.leaveGroup(conversationId, creatorId))
                .isInstanceOf(com.claudiordese.exceptions.BadRequestException.class);
        assertThat(conversations.members).contains(creatorId);
    }

    @Test
    void leaveGroup_rejectsANonMember() {
        UUID conversationId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, creatorId));
        conversations.members = List.of(creatorId);

        assertThatThrownBy(() -> service.leaveGroup(conversationId, UUID.randomUUID()))
                .isInstanceOf(NotFound.class);
    }

    @Test
    void leaveGroup_rejectsADirectMessage() {
        UUID conversationId = UUID.randomUUID();
        UUID a = UUID.randomUUID();
        conversations.conversation = Optional.of(new Conversation(
                conversationId, ConversationType.DM, null, "k", Instant.now(), null));
        conversations.members = List.of(a, UUID.randomUUID());

        assertThatThrownBy(() -> service.leaveGroup(conversationId, a))
                .isInstanceOf(com.claudiordese.exceptions.BadRequestException.class);
    }

    @Test
    void createGroup_tellsEveryoneIncludingTheCreator() {
        UUID creatorId = UUID.randomUUID();
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();

        service.createGroup(creatorId, "Friends", java.util.Set.of(first, second));

        assertThat(gateway.recipientsOf(MembersChangedEvent.class))
                .containsExactlyInAnyOrder(creatorId.toString(), first.toString(), second.toString());
    }

    @Test
    void deleteGroup_tellsTheMembersItIsGone() {
        UUID conversationId = UUID.randomUUID();
        UUID creatorId = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, creatorId));
        conversations.members = List.of(creatorId, other);

        service.deleteGroup(conversationId, creatorId);

        assertThat(gateway.recipientsOf(MembersChangedEvent.class))
                .containsExactlyInAnyOrder(creatorId.toString(), other.toString());
    }

    @Test
    void sendProfileChanged_reachesEveryoneWhoSharesAChatWithTheUser_andTheirOtherDevices() {
        UUID conversationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID friend = UUID.randomUUID();
        conversations.conversation = Optional.of(group(conversationId, userId));
        conversations.members = List.of(userId, friend);

        service.sendProfileChanged(userId);

        assertThat(gateway.recipientsOf(ProfileChangedEvent.class))
                .containsExactlyInAnyOrder(userId.toString(), friend.toString());
        assertThat(gateway.events).allSatisfy(event ->
                assertThat(((ProfileChangedEvent) event).getUserId()).isEqualTo(userId.toString()));
    }

    @Test
    void sendProfileChanged_forSomeoneInNoConversationsOnlyTellsThemselves() {
        UUID userId = UUID.randomUUID();

        service.sendProfileChanged(userId);

        assertThat(gateway.recipientsOf(ProfileChangedEvent.class)).containsExactly(userId.toString());
    }

    @Test
    void systemMessages_neverCountAsUnread() {
        UUID conversationId = UUID.randomUUID();
        messageStore.saveMessage(Message.system(conversationId, SystemEvent.MEMBER_ADDED, UUID.randomUUID()));
        messageStore.saveMessage(Message.user(conversationId, UUID.randomUUID(), "hi"));

        assertThat(messageStore.countSince(conversationId, -1)).isEqualTo(1);
        assertThat(messageStore.latestUserMessage(conversationId)).get()
                .extracting(Message::body).isEqualTo("hi");
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
        public Optional<Message> latestUserMessage(UUID conversationId) {
            return messages.stream()
                    .filter(message -> message.conversationId().equals(conversationId))
                    .filter(message -> message.type() == MessageType.USER)
                    .reduce((first, second) -> second);
        }

        @Override
        public long countSince(UUID conversationId, long lastReadSeq) {
            return messages.stream()
                    .filter(message -> message.conversationId().equals(conversationId))
                    .filter(message -> message.type() == MessageType.USER)
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
            this.conversation = Optional.of(conversation);
            return conversation;
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
            return members.contains(userId) ? conversation.stream().toList() : List.of();
        }

        @Override
        public ConversationMember addMember(UUID conversationId, UUID userId) {
            members = Stream.concat(members.stream(), Stream.of(userId)).toList();
            return null;
        }

        @Override
        public void removeMember(UUID conversationId, UUID userId) {
            members = members.stream().filter(member -> !member.equals(userId)).toList();
        }

        @Override
        public void delete(UUID conversationId) {
            conversation = Optional.empty();
            members = List.of();
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

        private final List<String> sentTo = new ArrayList<>();
        private final List<ServerEvent> events = new ArrayList<>();
        private final List<String> eventRecipients = new ArrayList<>();

        /** Who got an event of this type. */
        List<String> recipientsOf(Class<? extends ServerEvent> type) {
            List<String> result = new ArrayList<>();

            for (int i = 0; i < events.size(); i++) {
                if (type.isInstance(events.get(i))) result.add(eventRecipients.get(i));
            }

            return result;
        }

        @Override
        public boolean isOnline(String userId) {
            return false;
        }

        @Override
        public void send(String userId, ServerEvent event) {
            sentTo.add(userId);
            events.add(event);
            eventRecipients.add(userId);
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
