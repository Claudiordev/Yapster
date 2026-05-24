package com.claudiordese.comms.infrastructure.controllers.response;

import com.claudiordese.comms.application.service.result.MessageResult;

import java.time.Instant;

public record MessageResponse(
        String id,
        String sender,
        String receiver,
        String body,
        String providerId,
        String status,
        String price,
        String priceUnit,
        Instant createdAt) {

    public static MessageResponse from(MessageResult result) {
        return new MessageResponse(
                result.id().toString(),
                result.sender(),
                result.receiver(),
                result.body(),
                result.providerId(),
                result.status().name(),
                result.price(),
                result.priceUnit(),
                result.createdAt());
    }
}
