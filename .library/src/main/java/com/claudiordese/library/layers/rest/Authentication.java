package com.claudiordese.library.layers.rest;

import com.claudiordese.library.exceptions.NonValidLoginRequest;
import com.claudiordese.library.messages.producer.PlayerEventsProducer;
import com.claudiordese.library.model.dto.LoginRequestDTO;
import com.claudiordese.library.model.dto.PlayerDTO;
import com.claudiordese.library.model.entity.Player;
import com.claudiordese.library.model.mapper.PlayerMapper;
import com.claudiordese.library.repository.PlayerRepository;
import com.claudiordese.library.service.game.PlayerRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v2/auth")
public class Authentication {
    private final Logger logger = LoggerFactory.getLogger(Authentication.class);
    private final PlayerRepository playerRepository;
    private final PlayerRegistry playerRegistry;
    private final PlayerEventsProducer playerEventsProducer;
    private final PasswordEncoder passwordEncoder;


    public Authentication(PlayerRepository playerRepository, PlayerRegistry playerRegistry, PlayerEventsProducer playerEventsProducer, PasswordEncoder passwordEncoder) {
        this.playerRepository = playerRepository;
        this.playerRegistry = playerRegistry;
        this.playerEventsProducer = playerEventsProducer;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequestDTO loginRequestDTO) throws RuntimeException {
        Player player = playerRepository.findByUsername(loginRequestDTO.username()).orElseGet(() -> {
            Player newPlayer = new Player();
            newPlayer.setUsername(loginRequestDTO.username());
            newPlayer.setPassword(passwordEncoder.encode(loginRequestDTO.password()));

            return playerRepository.save(newPlayer);
        });

        if (!passwordEncoder.matches(loginRequestDTO.password(), player.getPassword())) {
            throw new NonValidLoginRequest();
        }

        PlayerDTO playerDTO = PlayerMapper.toPlayerDTO(player);

        playerRegistry.add(playerDTO);
        return new ResponseEntity<>(playerDTO, HttpStatus.OK);
    }

}
