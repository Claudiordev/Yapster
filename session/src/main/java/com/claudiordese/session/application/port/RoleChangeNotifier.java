package com.claudiordese.session.application.port;

import java.util.UUID;

/** Tells other services that a user's roles changed so they can react in real time. */
public interface RoleChangeNotifier {

    void rolesChanged(UUID userId);
}
