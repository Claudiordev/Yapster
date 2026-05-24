package com.claudiordese.comms.application.domain;

public enum MessageStatus {
    QUEUED,
    SENDING,
    SENT,
    FAILED,
    DELIVERED,
    UNDELIVERED,
    RECEIVING,
    RECEIVED,
    ACCEPTED,
    SCHEDULED,
    READ,
    PARTIALLY_DELIVERED,
    CANCELED;
}
