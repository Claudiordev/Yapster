package com.claudiordese.chat.infrastructure.entity;

import jakarta.persistence.Column;
import com.claudiordese.chat.application.domain.chat.types.MessageType;
import com.claudiordese.chat.application.domain.chat.types.SystemEvent;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "message")
@Getter
@Setter
public class MessageEntity {

    public MessageEntity() {}

    @Id
    private UUID id;

    //FK to Conversation
    @Column(name = "conversation_id")
    private UUID conversationId;

    @Column(name = "sender_id")
    private UUID senderId;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column
    private String body;

    @Enumerated(EnumType.STRING)
    @Column
    private MessageType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "system_event")
    private SystemEvent systemEvent;

    @Column(name = "subject_id")
    private UUID subjectId;

    @Generated(event = EventType.INSERT)
    @Column(insertable = false, updatable = false)
    private long seq;
}
