package com.claudiordese.library.layers.socket;

import com.claudiordese.library.model.domain.GameRoom;
import com.claudiordese.library.model.domain.Move;
import com.claudiordese.library.model.enums.MoveEventType;
import com.claudiordese.library.service.game.GamesRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Controller;

import java.util.UUID;

@Controller
@EnableScheduling
public class Games {
    private final SimpMessagingTemplate simpMessagingTemplate;
    private final GamesRegistry gamesRegistry;
    private final Logger logger = LoggerFactory.getLogger(Games.class);

    public Games(SimpMessagingTemplate simpMessagingTemplate, GamesRegistry gamesRegistry) {
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.gamesRegistry = gamesRegistry;
    }

    @MessageMapping("/game/{gameRoomId}/play")
    public void play(@DestinationVariable String gameRoomId, @Payload Move move) {
        try {
            GameRoom gameRoom = gamesRegistry.getGameRoom(UUID.fromString(gameRoomId));
            MoveEventType moveEventType = move.getMoveEventType();

            if (moveEventType == MoveEventType.ADD) {
                if (gameRoom.move(move)) {
                    simpMessagingTemplate.convertAndSend("/topic/game/" + gameRoomId + "/play", gameRoom);
                } else {
                    logger.warn("A player tried to do an unauthorized move");
                }
            }

        } catch (NullPointerException nullPointerException) {
            simpMessagingTemplate.convertAndSend("/topic/game/" + gameRoomId + "/play", "ERROR");
        }
    }

    @Scheduled(fixedRate = 555555)
    public void print() {
        logger.info("Games is running");
    }
}
