package com.claudiordese.comms.infrastructure.entity;

import com.claudiordese.comms.application.domain.MessageStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Getter
@Setter
@Table(name = "messages", schema = "public",
        indexes = @Index(
                name = "idx_messages_sender_created",
                columnList = "sender, created_at DESC"))
public class MessageEntity {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "sender", nullable = false, length = 64)
    private String sender;

    @Column(name = "receiver", nullable = false, length = 32)
    private String receiver;

    @Column(name = "body", nullable = false, length = 1600)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private MessageStatus status;

    @Column(name = "provider_id", length = 64)
    private String providerId;

    @Column(name = "price", length = 32)
    private String price;

    @Column(name = "price_unit", length = 16)
    private String priceUnit;

    @Column(name = "error_message", length = 512)
    private String errorMessage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
