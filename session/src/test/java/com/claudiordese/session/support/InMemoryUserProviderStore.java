package com.claudiordese.session.support;

import com.claudiordese.session.application.port.UserProviderStore;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public class InMemoryUserProviderStore implements UserProviderStore {

    private final Map<String, UUID> links = new HashMap<>();

    @Override
    public Optional<UUID> findUserId(String provider, String subject) {
        return Optional.ofNullable(links.get(provider + ":" + subject));
    }

    @Override
    public void link(UUID userId, String provider, String subject, String email) {
        links.put(provider + ":" + subject, userId);
    }

    public int size() {
        return links.size();
    }
}
