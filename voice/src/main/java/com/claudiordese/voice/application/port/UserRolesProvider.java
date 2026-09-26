package com.claudiordese.voice.application.port;

import java.util.Set;

/** A user's roles as they are right now, from the service that owns them (never from a JWT). */
public interface UserRolesProvider {

    Set<String> rolesOf(String userId);
}
