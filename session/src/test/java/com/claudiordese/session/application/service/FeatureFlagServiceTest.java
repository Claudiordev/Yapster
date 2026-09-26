package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.BadRequestException;
import com.claudiordese.exceptions.ConflictException;
import com.claudiordese.session.application.port.FeatureFlagStore;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FeatureFlagServiceTest {

    private final Map<String, Boolean> stored = new HashMap<>(Map.of("events", true, "premium", true, "game-servers", false));

    private final FeatureFlagService service = new FeatureFlagService(new FeatureFlagStore() {
        @Override
        public Map<String, Boolean> findAll() {
            return new HashMap<>(stored);
        }

        @Override
        public void create(String name, boolean enabled) {
            stored.put(name, enabled);
        }

        @Override
        public void update(Map<String, Boolean> changes) {
            stored.putAll(changes);
        }
    });

    @Test
    void update_appliesPartialChangeAndReturnsFullSet() {
        Map<String, Boolean> result = service.update(Map.of("game-servers", true));

        assertThat(result).containsEntry("game-servers", true).containsEntry("events", true).hasSize(3);
    }

    @Test
    void create_addsFeatureOffByDefault() {
        Map<String, Boolean> result = service.create("leaderboard", false);

        assertThat(result).containsEntry("leaderboard", false).hasSize(4);
    }

    @Test
    void create_rejectsExistingFeature() {
        assertThatThrownBy(() -> service.create("events", false)).isInstanceOf(ConflictException.class);
    }

    @Test
    void create_rejectsBadNames() {
        for (String bad : new String[] {null, "", "Events", "two words", "-lead", "trail-", "a--b", "x".repeat(65)}) {
            assertThatThrownBy(() -> service.create(bad, false)).isInstanceOf(BadRequestException.class);
        }
    }

    @Test
    void update_rejectsUnknownFeatureWithoutChangingAnything() {
        assertThatThrownBy(() -> service.update(Map.of("events", false, "nope", true)))
                .isInstanceOf(BadRequestException.class);

        assertThat(stored.get("events")).isTrue();
    }

    @Test
    void update_rejectsEmptyAndNullValues() {
        assertThatThrownBy(() -> service.update(Map.of())).isInstanceOf(BadRequestException.class);

        Map<String, Boolean> nullValue = new HashMap<>();
        nullValue.put("events", null);

        assertThatThrownBy(() -> service.update(nullValue)).isInstanceOf(BadRequestException.class);
    }
}
