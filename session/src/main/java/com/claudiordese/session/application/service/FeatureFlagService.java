package com.claudiordese.session.application.service;

import com.claudiordese.exceptions.BadRequestException;
import com.claudiordese.exceptions.ConflictException;
import com.claudiordese.session.application.port.FeatureFlagStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Pattern;

/** Which platform features are switched on. Read by every client at login; changed by admins. */
@Service
@RequiredArgsConstructor
public class FeatureFlagService {

    /** Lower-case words joined by dashes, like the menu keys ("game-servers"). */
    static final Pattern NAME = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    static final int MAX_NAME_LENGTH = 64;

    private final FeatureFlagStore flags;

    public Map<String, Boolean> all() {
        return new TreeMap<>(flags.findAll());
    }

    /** Adds a feature (switched off unless {@code enabled}) and returns the full set. */
    @Transactional
    public Map<String, Boolean> create(String name, boolean enabled) {
        if (name == null || name.length() > MAX_NAME_LENGTH || !NAME.matcher(name).matches()) {
            throw new BadRequestException("invalid_feature_name",
                    "Feature names are lower-case words joined by dashes, up to " + MAX_NAME_LENGTH + " characters");
        }
        if (flags.findAll().containsKey(name)) {
            throw new ConflictException("feature_exists", "Feature already exists: " + name);
        }

        flags.create(name, enabled);
        return all();
    }

    /** Applies a partial update and returns the full set. Unknown features are rejected, not created. */
    @Transactional
    public Map<String, Boolean> update(Map<String, Boolean> changes) {
        if (changes == null || changes.isEmpty()) {
            throw new BadRequestException("no_features", "Provide at least one feature to update");
        }

        Map<String, Boolean> known = flags.findAll();

        changes.forEach((name, enabled) -> {
            if (!known.containsKey(name)) {
                throw new BadRequestException("unknown_feature", "Unknown feature: " + name);
            }
            if (enabled == null) {
                throw new BadRequestException("invalid_feature_value", "Feature " + name + " must be true or false");
            }
        });

        flags.update(changes);
        return all();
    }
}
