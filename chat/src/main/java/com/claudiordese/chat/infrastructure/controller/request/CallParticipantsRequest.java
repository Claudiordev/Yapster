package com.claudiordese.chat.infrastructure.controller.request;

import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/**
 * Body of the voice service's report of who is in a conversation's call: the FULL
 * current list of user ids (empty = no call).
 *
 * The cap is only a guard against a runaway payload. A real list never exceeds the
 * conversation's member count (groups are limited to 15), and the service keeps
 * only actual members anyway.
 */
public record CallParticipantsRequest(@Size(max = 50) List<UUID> userIds) {
}
