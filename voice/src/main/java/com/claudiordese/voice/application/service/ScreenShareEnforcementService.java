package com.claudiordese.voice.application.service;

import com.claudiordese.voice.application.domain.rooms.ScreenSharePolicy;
import com.claudiordese.voice.application.domain.rooms.ScreenShareTrack;
import com.claudiordese.voice.application.port.ScreenShareControl;
import com.claudiordese.voice.application.port.UserRolesProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Keeps screen shares within what the publisher's roles allow.
 *
 * The browser publishes straight to LiveKit, so this can't sit in the media path. Instead it
 * checks after the fact: when a screen share is published (LiveKit webhook) and when the
 * publisher's roles change (session pushes it). Both re-read the roles from the session
 * service and the tracks from LiveKit, so neither a stale JWT nor a webhook payload is trusted.
 * An over-limit track is suspended; the client sees that and stops sharing.
 *
 * Failures are logged and swallowed (fail open): a session or LiveKit hiccup must not kill
 * legitimate calls, and the next publish or role change re-checks.
 */
@Service
public class ScreenShareEnforcementService {

    private static final Logger log = LoggerFactory.getLogger(ScreenShareEnforcementService.class);

    private final UserRolesProvider roles;
    private final ScreenShareControl control;
    private final ExecutorService background = Executors.newVirtualThreadPerTaskExecutor();

    public ScreenShareEnforcementService(UserRolesProvider roles, ScreenShareControl control) {
        this.roles = roles;
        this.control = control;
    }

    /** Checks one participant's screen shares in one room. */
    public void enforce(String room, String identity) {
        try {
            List<ScreenShareTrack> shares = control.screenSharesOf(room, identity);

            if (shares.isEmpty()) return;

            suspendOverLimit(room, identity, shares, roles.rolesOf(identity));
        } catch (RuntimeException e) {
            log.warn("Could not enforce screen share limit for {} in {}: {}", identity, room, e.getMessage());
        }
    }

    /** A user's roles changed: re-check them in every active call. Runs in the background. */
    public void enforceEverywhere(String userId) {
        background.execute(() -> {
            try {
                Set<String> current = roles.rolesOf(userId);

                for (String room : control.activeRooms()) {
                    List<ScreenShareTrack> shares = control.screenSharesOf(room, userId);

                    if (!shares.isEmpty()) suspendOverLimit(room, userId, shares, current);
                }
            } catch (RuntimeException e) {
                log.warn("Could not re-check screen shares for {} after a role change: {}", userId, e.getMessage());
            }
        });
    }

    private void suspendOverLimit(String room, String identity, List<ScreenShareTrack> shares, Set<String> current) {
        int allowed = ScreenSharePolicy.maxHeight(current);

        for (ScreenShareTrack share : shares) {
            // 0 = the publisher declared no size; nothing to judge it by.
            if (share.shortSide() > allowed) {
                log.info("Suspending {}p screen share of {} in {} (allowed {}p)",
                        share.shortSide(), identity, room, allowed);
                control.suspend(room, identity, share.sid());
            }
        }
    }
}
