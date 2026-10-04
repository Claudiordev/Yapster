package com.claudiordese.session.support;

import com.claudiordese.session.application.domain.LinkedProvider;
import com.claudiordese.session.application.port.UserProviderStore;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public class InMemoryUserProviderStore implements UserProviderStore {

    private record Link(UUID userId, String provider, String email, Instant linkedAt) {}

    private final Map<String, Link> links = new HashMap<>();

    @Override
    public Optional<UUID> findUserId(String provider, String subject) {
        return Optional.ofNullable(links.get(provider + ":" + subject)).map(Link::userId);
    }

    @Override
    public void link(UUID userId, String provider, String subject, String email) {
        links.put(provider + ":" + subject, new Link(userId, provider, email, Instant.now()));
    }

    @Override
    public List<LinkedProvider> findByUser(UUID userId) {
        List<LinkedProvider> found = new ArrayList<>();

        for (Link link : links.values()) {
            if (link.userId().equals(userId)) {
                found.add(new LinkedProvider(link.provider(), link.email(), link.linkedAt()));
            }
        }
        return found;
    }

    @Override
    public boolean unlink(UUID userId, String provider) {
        return links.values().removeIf(
                link -> link.userId().equals(userId) && link.provider().equals(provider));
    }

    public int size() {
        return links.size();
    }
}
