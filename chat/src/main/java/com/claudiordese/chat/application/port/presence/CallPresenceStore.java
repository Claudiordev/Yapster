package com.claudiordese.chat.application.port.presence;

import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Latest known participants of each conversation's active call. */
public interface CallPresenceStore {

    /** Replaces the snapshot; an empty set means the call ended and clears it. */
    void save(UUID conversationId, Set<UUID> participants);

    Set<UUID> find(UUID conversationId);

    /** Snapshots for many conversations; conversations without a call are absent. */
    Map<UUID, Set<UUID>> findAll(Collection<UUID> conversationIds);
}
