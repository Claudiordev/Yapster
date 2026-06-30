package com.claudiordese.session.infrastructure.configurations;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;

import java.time.Duration;

/**
 * Redis-backed caching. Redis (not Caffeine) because the services run multiple
 * instances and need a SHARED cache — an evict on one instance is seen by all.
 *
 * JSON value serialization (not JDK) because the cached domain {@code User}
 * carries {@code Optional} and {@code Set} fields — {@code Optional} is not
 * Java-Serializable, but Jackson (with the jdk8/parameter-names modules Boot
 * already registers) handles it. Default typing writes a {@code @class} hint so
 * records round-trip to the right type.
 *
 * Keys are namespaced + versioned ({@code session:<cache>:v1:<key>}) so a shared
 * Redis won't collide across services and a version bump orphans old-shape
 * entries. Every cache has a TTL — the default manager has none, leaking keys.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory,
                                          ObjectMapper bootObjectMapper) {
        // Reuse Boot's ObjectMapper (has jdk8 + parameter-names modules) but add
        // default typing on a copy so we don't mutate the shared bean.
        ObjectMapper cacheMapper = bootObjectMapper.copy().activateDefaultTyping(
                BasicPolymorphicTypeValidator.builder().allowIfBaseType(Object.class).build(),
                ObjectMapper.DefaultTyping.EVERYTHING,
                JsonTypeInfo.As.PROPERTY);

        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(5))
                .disableCachingNullValues()
                .computePrefixWith(cacheName -> "session:" + cacheName + ":v1:")
                .serializeValuesWith(SerializationPair.fromSerializer(
                        new GenericJackson2JsonRedisSerializer(cacheMapper)));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(base)
                .build();
    }
}
