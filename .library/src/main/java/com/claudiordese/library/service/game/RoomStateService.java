package com.claudiordese.library.service.game;

import com.claudiordese.library.old.Room;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RoomStateService {
    private final Map<String, Room> rooms = new ConcurrentHashMap<>();

    public void addRoom(Room room) {
        rooms.put(room.getRoomId(), room);
    }

    public List<Room> getAllRooms() {
        return new ArrayList<>(rooms.values());
    }

    /**
     * Generate a new UUID for a Room
     * @return String UUID
     */
    public String generateUUID() {
        String id;
        do {
            id = UUID.randomUUID().toString();
        } while (rooms.containsKey(id));
        return id;
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
