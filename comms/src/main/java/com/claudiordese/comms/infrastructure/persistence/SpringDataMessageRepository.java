package com.claudiordese.comms.infrastructure.persistence;

import com.claudiordese.comms.infrastructure.entity.MessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

interface SpringDataMessageRepository extends JpaRepository<MessageEntity, UUID> {

    List<MessageEntity> findBySenderOrderByCreatedAtAsc(String sender);
}
