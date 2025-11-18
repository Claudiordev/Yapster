package com.claudiordese.library.model.mapper;

import com.claudiordese.library.model.dto.PlayerDTO;
import com.claudiordese.library.model.entity.Player;

public class PlayerMapper {

    public static PlayerDTO toPlayerDTO(Player player) {
        if (player == null) {  return null; }
        return new PlayerDTO(
                player.getId(),
                player.getUsername(),
                null, player.getGamePoints(),
                player.getScore());
    }
}
