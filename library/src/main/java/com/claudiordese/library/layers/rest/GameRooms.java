package com.claudiordese.library.layers.rest;

import com.claudiordese.library.messages.producer.MessagesProducer;
import com.claudiordese.library.messages.producer.PlayerEventsProducer;
import com.claudiordese.library.model.domain.GameRoom;
import com.claudiordese.library.service.game.GamesRegistry;
import com.claudiordese.library.service.game.PlayerRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/game")
public class GameRooms {
    private PlayerEventsProducer playerEventsProducer;
    private MessagesProducer messagesProducer;
    private PlayerRegistry playerRegistry;
    private GamesRegistry gameRegistry;

    @Autowired
    public GameRooms(PlayerEventsProducer playerEventsProducer, MessagesProducer messagesProducer,PlayerRegistry playerRegistry) {
        this.playerEventsProducer = playerEventsProducer;
        this.messagesProducer = messagesProducer;
        this.playerRegistry = playerRegistry;
        this.gameRegistry = new GamesRegistry();
    }


    @PostMapping("/rooms")
    public ResponseEntity<String> addRom(@RequestParam String name) {
        GameRoom gameRoom = new GameRoom(name);

        gameRegistry.addGameRoom(gameRoom.getUuid(), gameRoom);

        return new  ResponseEntity<>(gameRoom.toString(), HttpStatus.OK);
    }

    @GetMapping("/rooms")
    public ResponseEntity<?> getGames() {
        return new ResponseEntity<>(gameRegistry.getGameRooms(),HttpStatus.OK);
    }

    @GetMapping("/moves/{player_id}")
    public ResponseEntity<?> getMoves(@PathVariable String player_id) {
        return new ResponseEntity<>(playerRegistry.getMovesByPlayer(UUID.fromString(player_id)), HttpStatus.OK);
    }

    @DeleteMapping("/moves/{move_id}")
    public ResponseEntity<String> deleteMoves(@PathVariable String move_id) {
        return new ResponseEntity<>("Deleted", HttpStatus.OK);
    }
}
