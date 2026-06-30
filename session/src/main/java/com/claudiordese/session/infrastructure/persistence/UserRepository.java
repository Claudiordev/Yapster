package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.infrastructure.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
interface UserRepository extends JpaRepository<UserEntity, UUID> {

    Optional<UserEntity> findByUsername(String username);

    Optional<UserEntity> findByEmail(String email);

    /** Case-insensitive contains-search, capped to keep the endpoint cheap. */
    List<UserEntity> findTop20ByUsernameContainingIgnoreCaseOrderByUsername(String fragment);
}
