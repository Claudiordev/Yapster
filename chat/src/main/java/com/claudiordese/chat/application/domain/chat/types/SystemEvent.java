package com.claudiordese.chat.application.domain.chat.types;

/** What a SYSTEM message announces; the client turns the code into text. */
public enum SystemEvent {
    MEMBER_ADDED,
    MEMBER_REMOVED,
    MEMBER_LEFT,
    GROUP_RENAMED // subject = who renamed it, body = the new name ("" when cleared)
}
