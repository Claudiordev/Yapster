package com.claudiordese.library.layers.socket;

import com.claudiordese.library.messages.producer.MessagesProducer;
import com.claudiordese.library.model.domain.Message;
import com.claudiordese.library.service.game.PlayerRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class Lobby {
    private final Logger logger = LoggerFactory.getLogger(Lobby.class);
    private final PlayerRegistry playerRegistry;
    private final SimpMessagingTemplate simpMessagingTemplate;
    private final MessagesProducer messagesProducer;

    public Lobby(PlayerRegistry playerRegistry, SimpMessagingTemplate simpMessagingTemplate, MessagesProducer messagesProducer) {
        this.playerRegistry = playerRegistry;
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.messagesProducer = messagesProducer;
    }

    @MessageMapping("/chat")
    public void lobby(Message message) {
        try {
            if (!playerRegistry.isLoggedIn(message.getPlayer().id())) {
                logger.warn("Player {} tried to send a message without being logged in", message.getPlayer().username());

                return;
            }

            simpMessagingTemplate.convertAndSend("/topic/lobby", message);
            messagesProducer.sendDataAsync(message);
        } catch (MessagingException messagingException) {
            logger.error(messagingException.getMessage(), messagingException);
        }
    }

}
