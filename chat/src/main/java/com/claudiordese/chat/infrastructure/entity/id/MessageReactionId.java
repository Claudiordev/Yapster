package com.claudiordese.chat.infrastructure.entity.id;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MessageReactionId implements Serializable {
    private UUID messageId;
    private UUID userId;
    private String emoji;
}
