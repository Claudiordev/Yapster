package com.claudiordese.chat.infrastructure.repository;

import com.claudiordese.chat.infrastructure.entity.ConversationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ConversationRepository extends JpaRepository<ConversationEntity, UUID> {
    Optional<ConversationEntity> findByDmKey(String dmKey);
}
