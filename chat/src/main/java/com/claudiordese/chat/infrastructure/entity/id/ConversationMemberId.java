package com.claudiordese.chat.infrastructure.entity.id;

import lombok.*;

import java.io.Serializable;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class ConversationMemberId implements Serializable {
    private UUID conversationId;
    private UUID userId;
}
