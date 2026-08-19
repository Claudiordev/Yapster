package com.claudiordese.chat.application.port.socket;

import com.claudiordese.chat.application.domain.chat.types.UserStatusType;
import com.claudiordese.chat.application.domain.event.server.ServerEvent;

/**
 * Layer of operations for sockets
 */
public interface EventGateway {

    boolean isOnline(String userId);

    /**
     * Send event to user by user id
     * @param userId JWT sub user ID
     * @param event ServerEvent, e.g. MESSAGE
     */
    void send(String userId, ServerEvent event);


    boolean setStatus(String userId, UserStatusType status);

    UserStatusType statusOf(String userId);

    int onlineUsers();

    int onlineDevices();
}
