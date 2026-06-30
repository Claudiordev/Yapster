package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.infrastructure.entity.ServerEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
interface ServerRepository extends JpaRepository<ServerEntity, UUID> {

    /** Fetch members alongside the server so the domain mapping never lazy-loads detached. */
    @EntityGraph(attributePaths = "members")
    Optional<ServerEntity> findById(UUID id);

    /**
     * Servers the user belongs to, with all members fetched.
     * {@code MEMBER OF} filters by membership without joining the fetched
     * collection — using a JOIN in the WHERE would wrongly restrict the
     * fetched members to just :userId.
     */
    @EntityGraph(attributePaths = "members")
    @Query("SELECT s FROM ServerEntity s WHERE :userId MEMBER OF s.members")
    List<ServerEntity> findAllByMember(@Param("userId") UUID userId);
}
