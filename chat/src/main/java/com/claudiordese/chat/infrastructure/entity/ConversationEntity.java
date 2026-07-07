package com.claudiordese.chat.infrastructure.entity;

import com.claudiordese.chat.application.domain.chat.types.ConversationType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table (name="conversation")
@Getter
@Setter
public class ConversationEntity {

    public ConversationEntity() {}

    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 16)
    private ConversationType type;

    @Column
    private String name;

    @Column(name = "dm_key")
    private String dmKey;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

}
