package com.claudiordese.chat.infrastructure.entity;

import com.claudiordese.chat.infrastructure.entity.id.MessageReactionId;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@IdClass(MessageReactionId.class)
@Table(name = "message_reaction")
@Getter
@Setter
public class MessageReactionEntity {

    public MessageReactionEntity() {}

    @Id
    @Column(name = "message_id")
    private UUID messageId;

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column
    private String emoji;

    @Column(name = "created_at")
    private Instant createdAt;
}
