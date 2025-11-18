package com.claudiordese.library.layers.rest;

import com.claudiordese.library.old.Room;
import com.claudiordese.library.repository.PlayerRepository;
import com.claudiordese.library.service.game.PlayerRegistry;
import com.claudiordese.library.service.game.RoomStateService;
import com.claudiordese.library.old.RoomEvent;
import com.claudiordese.library.old.RoomEventType;
import com.claudiordese.library.old.RoomProducer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/room")
public class Rooms {

    private final RoomProducer roomProducer;
    private final RoomStateService roomStateService;
    private final Logger logger = LoggerFactory.getLogger(Rooms.class);

    public Rooms(RoomProducer roomProducer, RoomStateService roomStateService, PlayerRegistry playerRegistry, PlayerRepository playerRepository) {
        this.roomProducer = roomProducer;
        this.roomStateService = roomStateService;
    }

    @PostMapping("/add")
    public ResponseEntity<String> addRoom() {
        try {
            Room room = new Room(roomStateService.generateUUID(),2);
            roomStateService.addRoom(room);

            roomProducer.sendMessage(new RoomEvent(room, RoomEventType.CREATE));

            return new ResponseEntity<>(room.toString(), HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    @GetMapping("/status")
    public ResponseEntity<String> getRoomsStatus() {
        try {
            return ResponseEntity.ok(new ObjectMapper().writeValueAsString(roomStateService.getAllRooms()));
        } catch (Exception e) {
            logger.error(e.getMessage());
            return ResponseEntity.ok("{}");
        }
    }
}
