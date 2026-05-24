package com.claudiordese.comms.application.domain;

import java.util.List;

/**
 * All messages a given sender has exchanged with one recipient, oldest first.
 */
public record Conversation(String receiver, List<Message> messages) {}
