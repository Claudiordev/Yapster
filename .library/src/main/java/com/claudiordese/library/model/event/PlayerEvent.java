package com.claudiordese.library.model.event;

import com.claudiordese.library.model.domain.GameRoom;
import com.claudiordese.library.model.dto.PlayerDTO;
import com.claudiordese.library.model.enums.PlayerEventType;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PlayerEvent {
    private GameRoom room;
    private PlayerDTO playerDTO;
    private PlayerEventType eventType;

    @Override
    public String toString() {
        try {
            return new ObjectMapper().writeValueAsString(this);
        } catch (Exception e) {
            return "{}";
        }
    }
}
