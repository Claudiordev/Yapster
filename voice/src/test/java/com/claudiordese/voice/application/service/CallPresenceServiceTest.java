package com.claudiordese.voice.application.service;

import com.claudiordese.voice.application.port.RoomPresenceProvider;
import com.claudiordese.voice.infrastructure.adapter.chat.ChatClient;
import com.claudiordese.voice.infrastructure.configurations.InternalProperties;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

class CallPresenceServiceTest {

    private final String room = UUID.randomUUID().toString();
    private final String alice = UUID.randomUUID().toString();
    private final String bob = UUID.randomUUID().toString();

    private final List<String> sentRooms = new ArrayList<>();
    private final List<List<String>> sentLists = new ArrayList<>();
    private final ChatClient chat = mock(ChatClient.class);

    private CallPresenceService serviceWith(RoomPresenceProvider provider) {
        doAnswer(invocation -> {
            sentRooms.add(invocation.getArgument(0));
            assertThat((String) invocation.getArgument(1)).isEqualTo("s3cret");
            sentLists.add(invocation.<ChatClient.CallParticipantsPayload>getArgument(2).userIds());
            return null;
        }).when(chat).publishCallParticipants(anyString(), anyString(), any());

        return new CallPresenceService(provider, chat, new InternalProperties("s3cret"));
    }

    @Test
    void publishesTheFullListReadFromLiveKit_dropsNonUuidIdentitiesAndDuplicates() {
        CallPresenceService service = serviceWith(r -> List.of(alice, bob, alice, "voice-service"));

        service.publish(room);

        assertThat(sentRooms).containsExactly(room);
        assertThat(sentLists.get(0)).containsExactly(alice, bob);
    }

    @Test
    void ignoresRoomsThatAreNotConversationIds() {
        CallPresenceService service = serviceWith(r -> List.of(alice));

        service.publish("some-other-room");
        service.publishEmpty("some-other-room");

        assertThat(sentRooms).isEmpty();
    }

    @Test
    void aFinishedRoomIsPublishedAsEmpty() {
        CallPresenceService service = serviceWith(r -> { throw new AssertionError("must not read LiveKit"); });

        service.publishEmpty(room);

        assertThat(sentLists.get(0)).isEmpty();
    }

    @Test
    void aFailureIsSwallowedSoTheWebhookStillAnswers() {
        CallPresenceService service = new CallPresenceService(
                r -> { throw new IllegalStateException("livekit down"); }, chat, new InternalProperties("s3cret"));

        service.publish(room);   // must not throw

        assertThat(sentRooms).isEmpty();
    }

    @Test
    void aChatFailureIsSwallowedToo() {
        doThrow(new IllegalStateException("chat down")).when(chat).publishCallParticipants(anyString(), anyString(), any());
        CallPresenceService service = new CallPresenceService(r -> List.of(alice), chat, new InternalProperties("s3cret"));

        service.publish(room);   // must not throw
    }
}
