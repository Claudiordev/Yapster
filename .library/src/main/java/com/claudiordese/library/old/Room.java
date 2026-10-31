package com.claudiordese.library.old;

import com.claudiordese.library.model.dto.PlayerDTO;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor(force = true)
@AllArgsConstructor
public class Room {
    private String roomId;
    private int players;
    private final int maxPlayers;
    private int spectators;
    private int maxSpectators;
    private String status;
    private List<PlayerDTO> playersList = new ArrayList<>();
    private char[][] board;

    public Room(String roomId, int maxPlayers) {
        this.roomId = roomId;
        this.maxPlayers = maxPlayers;
    }

    /**
     * Add player to a room
     * @param player
     * @return
     */
    public boolean add(PlayerDTO player) {
        if (players < maxPlayers) {
            playersList.add(player);
            players++;
            return true;
        }

        return false;
    }

    /**
     * Remove a player
     * @param player
     * @return
     */
    public boolean remove(PlayerDTO player) {
        if (playersList != null && playersList.remove(player)) {
            players--;
            return true;
        }

        return false;
    }

    @Override
    public String toString() {
        try {
            return new ObjectMapper().writeValueAsString(this);
        } catch (Exception e) {
            return "{}";
        }
    }
}
