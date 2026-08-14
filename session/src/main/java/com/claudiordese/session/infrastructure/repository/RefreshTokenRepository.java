package com.claudiordese.session.infrastructure.repository;

import com.claudiordese.session.infrastructure.entity.RefreshTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, UUID> {
    Optional<RefreshTokenEntity> findByToken(String token);
    void deleteByUsername(String username);

    /**
     * Single bulk {@code DELETE ... WHERE id = ?} that returns the number of rows
     * removed. Unlike an entity-based delete, this issues no row-count consistency
     * check (no {@code StaleObjectStateException}) and its return value lets the
     * caller tell whether it actually removed the row or lost a rotation race.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from RefreshTokenEntity r where r.id = :id")
    int deleteRowById(@Param("id") UUID id);
}
