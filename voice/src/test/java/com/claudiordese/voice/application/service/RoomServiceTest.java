package com.claudiordese.voice.application.service;

import com.claudiordese.voice.infrastructure.configurations.InternalProperties;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RoomServiceTest {

    @Test
    void muteParticipant_authorizesBeforeMutatingLiveKit() {
        List<String> calls = new ArrayList<>();
        RoomService service = new RoomService(
                (identity, room) -> null,
                (conversationId, authorization) -> {},
                (conversationId, targetUserId, authorization) ->
                        calls.add("authorize:" + conversationId + ":" + targetUserId + ":" + authorization),
                (room, participantIdentity) ->
                        calls.add("mute:" + room + ":" + participantIdentity),
                room -> 0,
                null,
                new InternalProperties("secret"));

        service.muteParticipant(" room-id ", " target-id ", "Bearer token");

        assertThat(calls).containsExactly(
                "authorize:room-id:target-id:Bearer token",
                "mute:room-id:target-id");
    }
}
