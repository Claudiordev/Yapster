package com.claudiordese.session.application.port;

import java.util.Map;

public interface FeatureFlagStore {

    /** Every feature and whether it is on. */
    Map<String, Boolean> findAll();

    /** Adds a new feature. The name must not exist yet. */
    void create(String name, boolean enabled);

    /** Sets the given features; every name must already exist. */
    void update(Map<String, Boolean> changes);
}
