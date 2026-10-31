package com.claudiordese.chat.application.domain.event;

import com.claudiordese.chat.application.domain.event.server.ReactionEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ReactionEventTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void serializesWithItsTypeAndNoStrayFields() {
        JsonNode json = mapper.valueToTree(ReactionEvent.added("room", "message", "user", "1f44d"));

        assertThat(json.get("type").asText()).isEqualTo("REACTION_ADDED");
        assertThat(json.get("roomId").asText()).isEqualTo("room");
        assertThat(json.get("messageId").asText()).isEqualTo("message");
        assertThat(json.get("userId").asText()).isEqualTo("user");
        assertThat(json.get("emoji").asText()).isEqualTo("1f44d");
        assertThat(json.size()).isEqualTo(5);
    }

    @Test
    void removedEventCarriesTheRemovedType() {
        JsonNode json = mapper.valueToTree(ReactionEvent.removed("room", "message", "user", "1f44d"));

        assertThat(json.get("type").asText()).isEqualTo("REACTION_REMOVED");
    }
}
