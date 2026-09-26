package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.application.port.FeatureFlagStore;
import com.claudiordese.session.infrastructure.entity.FeatureFlagEntity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class JpaFeatureFlagStore implements FeatureFlagStore {

    private final FeatureFlagRepository repo;

    public JpaFeatureFlagStore(FeatureFlagRepository repo) {
        this.repo = repo;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Boolean> findAll() {
        Map<String, Boolean> all = new LinkedHashMap<>();

        repo.findAll().forEach(flag -> all.put(flag.getName(), flag.isEnabled()));
        return all;
    }

    @Override
    @Transactional
    public void create(String name, boolean enabled) {
        FeatureFlagEntity flag = new FeatureFlagEntity();

        flag.setName(name);
        flag.setEnabled(enabled);
        repo.saveAndFlush(flag);
    }

    @Override
    @Transactional
    public void update(Map<String, Boolean> changes) {
        repo.findAllById(changes.keySet()).forEach(flag -> flag.setEnabled(changes.get(flag.getName())));
    }
}
