package com.claudiordese.chat.infrastructure.adapter.socket;

import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.infrastructure.configuration.SocketClusterProperties;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations.TypedTuple;
import org.springframework.data.redis.core.DefaultTypedTuple;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.Collection;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Redis layout (prefix configurable):
 * <ul>
 *   <li>{@code <p>:user:<userId>}: sorted set, member = connection id, score = expiry in epoch millis</li>
 *   <li>{@code <p>:conns}: sorted set of every connection, member = {@code userId|connectionId}, same score</li>
 *   <li>{@code <p>:status}: hash, userId to {@link UserStatusType}</li>
 * </ul>
 * The score is what makes a crashed replica harmless: nobody refreshes its connections,
 * so they fall out of every count once the ttl passes.
 */
@Component
public class RedisSocketRegistry implements SocketRegistry {

    private static final char SEPARATOR = '|';

    private final StringRedisTemplate redis;
    private final Clock clock;
    private final Duration ttl;
    private final String userKeyPrefix;
    private final String connsKey;
    private final String statusKey;

    public RedisSocketRegistry(StringRedisTemplate redis, SocketClusterProperties properties) {
        this(redis, properties, Clock.systemUTC());
    }

    RedisSocketRegistry(StringRedisTemplate redis, SocketClusterProperties properties, Clock clock) {
        this.redis = redis;
        this.clock = clock;
        this.ttl = properties.connectionTtl();
        this.userKeyPrefix = properties.keyPrefix() + ":user:";
        this.connsKey = properties.keyPrefix() + ":conns";
        this.statusKey = properties.keyPrefix() + ":status";
    }

    @Override
    public void add(String userId, String connectionId) {
        refresh(Map.of(userId, Set.of(connectionId)));
    }

    @Override
    public void remove(String userId, String connectionId) {
        redis.opsForZSet().remove(userKey(userId), connectionId);
        redis.opsForZSet().remove(connsKey, member(userId, connectionId));
    }

    @Override
    public void refresh(Map<String, ? extends Collection<String>> connectionsByUser) {
        double expiry = clock.millis() + ttl.toMillis();
        Set<TypedTuple<String>> all = new HashSet<>();

        connectionsByUser.forEach((userId, connectionIds) -> {
            Set<TypedTuple<String>> own = new HashSet<>();

            for (String connectionId : connectionIds) {
                own.add(new DefaultTypedTuple<>(connectionId, expiry));
                all.add(new DefaultTypedTuple<>(member(userId, connectionId), expiry));
            }
            if (own.isEmpty()) return;

            String key = userKey(userId);
            redis.opsForZSet().add(key, own);
            //Drops entries of crashed replicas and lets an abandoned key vanish on its own
            redis.opsForZSet().removeRangeByScore(key, 0, clock.millis());
            redis.expire(key, ttl.multipliedBy(3));
        });

        if (all.isEmpty()) return;
        redis.opsForZSet().add(connsKey, all);
        redis.opsForZSet().removeRangeByScore(connsKey, 0, clock.millis());
    }

    @Override
    public long connectionCount(String userId) {
        Long count = redis.opsForZSet().count(userKey(userId), clock.millis() + 1, Double.POSITIVE_INFINITY);
        return count == null ? 0 : count;
    }

    @Override
    public int onlineUsers() {
        Set<String> members = redis.opsForZSet().rangeByScore(connsKey, clock.millis() + 1, Double.POSITIVE_INFINITY);
        if (members == null) return 0;

        Set<String> users = new HashSet<>();
        for (String member : members) users.add(member.substring(0, member.indexOf(SEPARATOR)));
        return users.size();
    }

    @Override
    public int onlineDevices() {
        Long count = redis.opsForZSet().count(connsKey, clock.millis() + 1, Double.POSITIVE_INFINITY);
        return count == null ? 0 : count.intValue();
    }

    @Override
    public Optional<UserStatusType> status(String userId) {
        Object stored = redis.opsForHash().get(statusKey, userId);
        return stored == null ? Optional.empty() : Optional.of(UserStatusType.valueOf(stored.toString()));
    }

    @Override
    public boolean putStatus(String userId, UserStatusType status) {
        Optional<UserStatusType> previous = status(userId);
        redis.opsForHash().put(statusKey, userId, status.name());
        return previous.map(p -> p != status).orElse(true);
    }

    @Override
    public void clearStatus(String userId) {
        redis.opsForHash().delete(statusKey, userId);
    }

    private String userKey(String userId) {
        return userKeyPrefix + userId;
    }

    private static String member(String userId, String connectionId) {
        return userId + SEPARATOR + connectionId;
    }
}
