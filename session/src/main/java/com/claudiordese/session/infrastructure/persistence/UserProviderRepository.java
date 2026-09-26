package com.claudiordese.session.infrastructure.persistence;

import com.claudiordese.session.infrastructure.entity.UserProviderEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
interface UserProviderRepository extends JpaRepository<UserProviderEntity, UUID> {

    Optional<UserProviderEntity> findByProviderAndSubject(String provider, String subject);
}
