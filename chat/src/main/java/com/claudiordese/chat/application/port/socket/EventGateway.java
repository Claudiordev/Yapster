package com.claudiordese.chat.application.port.socket;

import com.claudiordese.chat.application.domain.event.ServerEvent;

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
}
