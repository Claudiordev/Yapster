package com.claudiordese.chat.infrastructure.adapter.presence;

import com.claudiordese.chat.application.port.presence.CallPresenceStore;
import com.claudiordese.chat.infrastructure.configuration.CallPresenceProperties;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** One Redis string per conversation: comma-separated user ids, with a safety-net TTL. */
@Component
public class RedisCallPresenceStore implements CallPresenceStore {

    private static final String PREFIX = "chat:call-presence:";

    private final StringRedisTemplate redis;
    private final CallPresenceProperties properties;

    public RedisCallPresenceStore(StringRedisTemplate redis, CallPresenceProperties properties) {
        this.redis = redis;
        this.properties = properties;
    }

    @Override
    public void save(UUID conversationId, Set<UUID> participants) {
        String key = PREFIX + conversationId;

        if (participants.isEmpty()) {
            redis.delete(key);
            return;
        }
        String value = participants.stream().map(UUID::toString).sorted().collect(Collectors.joining(","));

        redis.opsForValue().set(key, value, properties.ttl());
    }

    @Override
    public Set<UUID> find(UUID conversationId) {
        return parse(redis.opsForValue().get(PREFIX + conversationId));
    }

    @Override
    public Map<UUID, Set<UUID>> findAll(Collection<UUID> conversationIds) {
        List<UUID> ids = new ArrayList<>(conversationIds);
        Map<UUID, Set<UUID>> result = new HashMap<>();

        if (ids.isEmpty()) return result;

        List<String> values = redis.opsForValue().multiGet(ids.stream().map(id -> PREFIX + id).toList());

        for (int i = 0; i < ids.size(); i++) {
            Set<UUID> participants = parse(values == null ? null : values.get(i));

            if (!participants.isEmpty()) result.put(ids.get(i), participants);
        }
        return result;
    }

    private static Set<UUID> parse(String value) {
        if (value == null || value.isBlank()) return Set.of();

        return Arrays.stream(value.split(",")).map(UUID::fromString).collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
