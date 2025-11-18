package com.claudiordese.library.service.game;

import com.claudiordese.library.global.JSONSerializer;
import com.claudiordese.library.model.domain.GameRoom;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GamesRegistry {
    private final Map<UUID,GameRoom> gameRooms = new ConcurrentHashMap<>();

    public void addGameRoom(UUID uuid, GameRoom gameRoom) {
        gameRooms.putIfAbsent(uuid, gameRoom);
    }

    public GameRoom getGameRoom(UUID uuid) throws NullPointerException{
        return gameRooms.get(uuid);
    }

    public List<GameRoom> getGameRooms() {
        return new ArrayList<>(gameRooms.values());
    }
}
