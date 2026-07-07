package com.claudiordese.voice.infrastructure.controllers.voice;

import com.claudiordese.voice.application.domain.rooms.RoomAccess;
import com.claudiordese.voice.application.service.RoomService;
import com.claudiordese.voice.infrastructure.controllers.response.RoomAccessResponse;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Issues LiveKit join tokens. The caller must present a valid session JWT.
 * Subject becomes the LiveKit participant identity.
 * User can never mint a token for other users.
 */
@RestController
@RequestMapping("${url.api.base-path}/voice")
public class VoiceController {

    private final RoomService roomService;

    public VoiceController(RoomService roomService) {
        this.roomService = roomService;
    }

    @PostMapping("/rooms/{room}/token")
    public RoomAccessResponse joinRoom(Authentication authentication, @PathVariable String room) {
        RoomAccess access = roomService.join(authentication.getName(), room);
        return RoomAccessResponse.from(access);
    }
}
