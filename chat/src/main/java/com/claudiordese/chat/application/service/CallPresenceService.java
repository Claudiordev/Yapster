package com.claudiordese.chat.application.service;

import com.claudiordese.chat.application.domain.event.server.CallParticipantsEvent;
import com.claudiordese.chat.application.port.persistence.ConversationStore;
import com.claudiordese.chat.application.port.presence.CallPresenceStore;
import com.claudiordese.chat.application.port.scheduling.DelayedExecutor;
import com.claudiordese.chat.application.port.socket.EventGateway;
import com.claudiordese.chat.infrastructure.configuration.CallPresenceProperties;
import com.claudiordese.exceptions.InterdictedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Keeps track of who is in each conversation's call and tells the conversation's
 * online members.
 *
 * The voice service reports the FULL current participant list (read from LiveKit).
 * Updates within {@code batchWindow} are coalesced into one push carrying the latest
 * list. Conversations with more than {@code maxBroadcastMembers} members get no
 * push at all; their clients read the snapshot instead. Only members ever see or
 * receive a conversation's participants.
 */
@Service
public class CallPresenceService {

    private static final Logger log = LoggerFactory.getLogger(CallPresenceService.class);

    private final CallPresenceStore store;
    private final ConversationStore conversations;
    private final EventGateway events;
    private final DelayedExecutor delayed;
    private final CallPresenceProperties properties;
    /** Conversations with a push already scheduled (the scheduled task reads the latest snapshot). */
    private final Set<UUID> pending = ConcurrentHashMap.newKeySet();

    public CallPresenceService(CallPresenceStore store,
                               ConversationStore conversations,
                               EventGateway events,
                               DelayedExecutor delayed,
                               CallPresenceProperties properties) {
        this.store = store;
        this.conversations = conversations;
        this.events = events;
        this.delayed = delayed;
        this.properties = properties;
    }

    /** Called by the voice service (internal endpoint) with the full current list. */
    public void update(UUID conversationId, Collection<UUID> participants) {
        store.save(conversationId, Set.copyOf(participants));

        //Use so we wait one second before we send in so burst of requests becomes one message
        if (pending.add(conversationId)) {
            delayed.schedule(() -> flush(conversationId), properties.batchWindow());
        }
    }

    void flush(UUID conversationId) {
        // Remove first: an update arriving while we send schedules the next push.
        pending.remove(conversationId);

        try {
            List<UUID> members = conversations.membersOf(conversationId);

            if (members.size() > properties.maxBroadcastMembers()) return;

            Set<UUID> memberSet = Set.copyOf(members);
            List<String> ids = store.find(conversationId).stream()
                    .filter(memberSet::contains)
                    .map(UUID::toString)
                    .sorted()
                    .toList();
            CallParticipantsEvent event = new CallParticipantsEvent(conversationId.toString(), ids);

            for (UUID member : members) {
                events.send(member.toString(), event);
            }
        } catch (RuntimeException e) {
            log.warn("Could not push call participants for {}: {}", conversationId, e.getMessage());
        }
    }

    /** The current participants of a conversation's call, for one of its members. */
    public List<UUID> participantsOf(UUID conversationId, UUID requester) {
        if (!conversations.isMember(conversationId, requester)) {
            throw new InterdictedException("not_a_member", "Not a member of this conversation");
        }
        return members(store.find(conversationId), conversations.membersOf(conversationId));
    }

    /**
     * Snapshots for conversations the caller already belongs to (the list endpoint
     * only ever passes the caller's own conversations).
     */
    public Map<UUID, List<UUID>> snapshotsFor(Collection<UUID> conversationIds) {
        Map<UUID, List<UUID>> result = new HashMap<>();

        store.findAll(conversationIds).forEach((conversationId, participants) ->
                result.put(conversationId, participants.stream().sorted().collect(Collectors.toList())));
        return result;
    }

    private static List<UUID> members(Set<UUID> participants, List<UUID> members) {
        Set<UUID> memberSet = Set.copyOf(members);

        return participants.stream().filter(memberSet::contains).sorted().toList();
    }
}
