package com.claudiordese.comms.dto;

import com.claudiordese.comms.entity.Message;

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

    public static MessageResponse from(Message message) {
        return new MessageResponse(
                message.getId().toString(),
                message.getSender(),
                message.getReceiver(),
                message.getBody(),
                message.getProviderId(),
                message.getStatus().name(),
                message.getPrice(),
                message.getPriceUnit(),
                message.getCreatedAt());
    }
}
