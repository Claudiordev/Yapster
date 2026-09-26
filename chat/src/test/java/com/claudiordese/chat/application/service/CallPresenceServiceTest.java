package com.claudiordese.chat.application.service;

import com.claudiordese.chat.application.domain.event.server.CallParticipantsEvent;
import com.claudiordese.chat.application.domain.event.server.ServerEvent;
import com.claudiordese.chat.application.port.persistence.ConversationStore;
import com.claudiordese.chat.application.port.presence.CallPresenceStore;
import com.claudiordese.chat.application.port.scheduling.DelayedExecutor;
import com.claudiordese.chat.application.port.socket.EventGateway;
import com.claudiordese.chat.infrastructure.configuration.CallPresenceProperties;
import com.claudiordese.exceptions.InterdictedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CallPresenceServiceTest {

    private final UUID conversation = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final UUID carol = UUID.randomUUID();

    private final Map<UUID, Set<UUID>> snapshots = new HashMap<>();
    private final List<Runnable> scheduled = new ArrayList<>();
    private final List<String> recipients = new ArrayList<>();
    private final List<CallParticipantsEvent> sent = new ArrayList<>();
    private ConversationStore conversations;
    private CallPresenceService service;

    @BeforeEach
    void setUp() {
        conversations = mock(ConversationStore.class);
        when(conversations.membersOf(conversation)).thenReturn(List.of(alice, bob, carol));
        when(conversations.isMember(conversation, alice)).thenReturn(true);

        CallPresenceStore store = new CallPresenceStore() {
            @Override public void save(UUID id, Set<UUID> participants) {
                if (participants.isEmpty()) snapshots.remove(id); else snapshots.put(id, participants);
            }
            @Override public Set<UUID> find(UUID id) { return snapshots.getOrDefault(id, Set.of()); }
            @Override public Map<UUID, Set<UUID>> findAll(Collection<UUID> ids) {
                Map<UUID, Set<UUID>> result = new HashMap<>();
                ids.forEach(id -> { if (snapshots.containsKey(id)) result.put(id, snapshots.get(id)); });
                return result;
            }
        };
        DelayedExecutor delayed = (task, delay) -> scheduled.add(task);
        EventGateway events = mock(EventGateway.class);
        org.mockito.Mockito.doAnswer(invocation -> {
            recipients.add(invocation.getArgument(0));
            sent.add((CallParticipantsEvent) invocation.<ServerEvent>getArgument(1));
            return null;
        }).when(events).send(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());

        service = new CallPresenceService(store, conversations, events, delayed,
                new CallPresenceProperties(20, Duration.ofSeconds(1), Duration.ofHours(6)));
    }

    @Test
    void updatesWithinTheWindowBecomeOnePushWithTheLatestList() {
        service.update(conversation, Set.of(alice));
        service.update(conversation, Set.of(alice, bob));
        service.update(conversation, Set.of(alice, bob, carol));

        assertThat(scheduled).hasSize(1);          // one timer, not three
        scheduled.get(0).run();

        assertThat(recipients).containsExactlyInAnyOrder(alice.toString(), bob.toString(), carol.toString());
        assertThat(sent.get(0).getUserIds()).containsExactlyInAnyOrder(alice.toString(), bob.toString(), carol.toString());
    }

    @Test
    void anUpdateAfterAFlushSchedulesTheNextPush() {
        service.update(conversation, Set.of(alice));
        scheduled.remove(0).run();

        service.update(conversation, Set.of());     // everyone left

        assertThat(scheduled).hasSize(1);
        scheduled.get(0).run();
        assertThat(sent.get(sent.size() - 1).getUserIds()).isEmpty();
    }

    @Test
    void conversationsOverTheCapGetNoLivePush() {
        List<UUID> many = new ArrayList<>();
        for (int i = 0; i < 21; i++) many.add(UUID.randomUUID());
        when(conversations.membersOf(conversation)).thenReturn(many);

        service.update(conversation, Set.of(many.get(0)));
        scheduled.get(0).run();

        assertThat(sent).isEmpty();
        assertThat(service.snapshotsFor(List.of(conversation))).containsKey(conversation); // still readable
    }

    @Test
    void onlyMembersAppearInTheList() {
        UUID stranger = UUID.randomUUID();

        service.update(conversation, Set.of(alice, stranger));
        scheduled.get(0).run();

        assertThat(sent.get(0).getUserIds()).containsExactly(alice.toString());
    }

    @Test
    void aNonMemberCannotReadTheParticipants() {
        service.update(conversation, Set.of(alice));

        assertThatThrownBy(() -> service.participantsOf(conversation, UUID.randomUUID()))
                .isInstanceOf(InterdictedException.class);
        assertThat(service.participantsOf(conversation, alice)).containsExactly(alice);
    }
}
