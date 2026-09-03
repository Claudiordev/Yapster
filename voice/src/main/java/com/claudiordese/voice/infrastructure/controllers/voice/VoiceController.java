package com.claudiordese.voice.infrastructure.controllers.voice;

import com.claudiordese.voice.application.domain.rooms.RoomAccess;
import com.claudiordese.voice.application.domain.rooms.RoomStatus;
import com.claudiordese.voice.application.service.RoomService;
import com.claudiordese.voice.infrastructure.controllers.response.RoomAccessResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Issues LiveKit join tokens. The caller must present a valid session JWT.
 * Subject becomes the LiveKit participant identity. {@code room} is always a
 * chat conversation id -- RoomService verifies the caller is actually a
 * member of it (via chat) before minting a token, so a user can never mint a
 * token for other users or join a call they don't belong to.
 */
@RestController
@RequestMapping("${url.api.base-path}/voice")
public class VoiceController {

    private final RoomService roomService;

    public VoiceController(RoomService roomService) {
        this.roomService = roomService;
    }

    @PostMapping("/rooms/{room}/token")
    public RoomAccessResponse joinRoom(
            Authentication authentication,
            @PathVariable String room,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        RoomAccess access = roomService.join(authentication.getName(), room, authorization);
        return RoomAccessResponse.from(access);
    }

    @GetMapping("/rooms/{room}/status")
    public RoomStatus roomStatus(
            Authentication authentication,
            @PathVariable String room,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        return roomService.status(room, authorization);
    }

}
