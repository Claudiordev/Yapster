package com.claudiordese.chat.infrastructure.entity;

import com.claudiordese.chat.infrastructure.entity.id.ConversationMemberId;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@IdClass(ConversationMemberId.class)
@Table(name = "conversation_member")
@Getter
@Setter
public class ConversationMemberEntity {

    public ConversationMemberEntity() {}

    @Id
    @Column(name = "conversation_id")
    private UUID conversationId;

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "last_read_seq")
    private long lastReadSeq;
}
