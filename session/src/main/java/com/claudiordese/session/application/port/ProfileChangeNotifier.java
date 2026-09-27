package com.claudiordese.session.application.port;

import java.util.UUID;

/** Tells other services that a user's picture or name changed, so people who see them can update. */
public interface ProfileChangeNotifier {
    void profileChanged(UUID userId);
}
