package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.infrastructure.entity.FeatureFlagEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
interface FeatureFlagRepository extends JpaRepository<FeatureFlagEntity, String> {
}
