package com.claudiordese.dto;

public record OrderEvent(
        long blockId,
        String side,
        String tokenId,
        double amount,
        double price,
        boolean success,
        String orderId,
        String status,
        String makingAmount,
        String takingAmount,
        String transactionHash,
        String error
) {}
