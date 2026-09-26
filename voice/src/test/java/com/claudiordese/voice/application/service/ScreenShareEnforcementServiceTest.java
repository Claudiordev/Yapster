package com.claudiordese.voice.application.service;

import com.claudiordese.voice.application.domain.rooms.ScreenSharePolicy;
import com.claudiordese.voice.application.domain.rooms.ScreenShareTrack;
import com.claudiordese.voice.application.port.ScreenShareControl;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ScreenShareEnforcementServiceTest {

    private final Map<String, Set<String>> rolesByUser = new java.util.HashMap<>();
    private final List<String> suspended = new java.util.concurrent.CopyOnWriteArrayList<>();
    private ScreenShareTrack track = new ScreenShareTrack("TR_1", 2560, 1440);

    private final ScreenShareControl control = new ScreenShareControl() {
        @Override
        public List<String> activeRooms() {
            return List.of("room-a", "room-b");
        }

        @Override
        public List<ScreenShareTrack> screenSharesOf(String room, String identity) {
            return room.equals("room-a") ? List.of(track) : List.of();
        }

        @Override
        public void suspend(String room, String identity, String trackSid) {
            suspended.add(room + ":" + identity + ":" + trackSid);
        }
    };

    private final ScreenShareEnforcementService service =
            new ScreenShareEnforcementService(userId -> rolesByUser.getOrDefault(userId, Set.of()), control);

    @Test
    void policy_mapsRolesToCeiling() {
        assertThat(ScreenSharePolicy.maxHeight(Set.of())).isEqualTo(1080);
        assertThat(ScreenSharePolicy.maxHeight(Set.of("USER"))).isEqualTo(1080);
        assertThat(ScreenSharePolicy.maxHeight(Set.of("PREMIUM"))).isEqualTo(1440);
        assertThat(ScreenSharePolicy.maxHeight(Set.of("PREMIUM_PLUS"))).isEqualTo(2160);
        assertThat(ScreenSharePolicy.maxHeight(Set.of("MODERATOR"))).isEqualTo(2160);
        assertThat(ScreenSharePolicy.maxHeight(Set.of("USER", "ADMIN"))).isEqualTo(2160);
    }

    @Test
    void enforce_suspendsShareAboveTheRolesCeiling() {
        rolesByUser.put("u1", Set.of("USER"));

        service.enforce("room-a", "u1");

        assertThat(suspended).containsExactly("room-a:u1:TR_1");
    }

    @Test
    void enforce_leavesShareWithinCeiling() {
        rolesByUser.put("u1", Set.of("PREMIUM"));

        service.enforce("room-a", "u1");

        assertThat(suspended).isEmpty();
    }

    @Test
    void enforce_judgesByShortSide_soUltrawide1080StaysAllowed() {
        track = new ScreenShareTrack("TR_1", 2560, 1080);
        rolesByUser.put("u1", Set.of());

        service.enforce("room-a", "u1");

        assertThat(suspended).isEmpty();
    }

    @Test
    void enforce_ignoresShareWithNoDeclaredSize() {
        track = new ScreenShareTrack("TR_1", 0, 0);
        rolesByUser.put("u1", Set.of());

        service.enforce("room-a", "u1");

        assertThat(suspended).isEmpty();
    }

    @Test
    void enforce_failsOpenWhenRolesCannotBeRead() {
        ScreenShareEnforcementService failing = new ScreenShareEnforcementService(
                userId -> { throw new IllegalStateException("session down"); }, control);

        failing.enforce("room-a", "u1");

        assertThat(suspended).isEmpty();
    }

    @Test
    void enforceEverywhere_rechecksEveryActiveRoomWithFreshRoles() throws Exception {
        rolesByUser.put("u1", Set.of("PREMIUM")); // just downgraded from PREMIUM_PLUS
        track = new ScreenShareTrack("TR_1", 3840, 2160);

        service.enforceEverywhere("u1");

        // Runs on a background thread; give it a moment.
        long deadline = System.currentTimeMillis() + 3_000;

        while (suspended.isEmpty() && System.currentTimeMillis() < deadline) Thread.sleep(10);

        assertThat(suspended).containsExactly("room-a:u1:TR_1");
    }
}
