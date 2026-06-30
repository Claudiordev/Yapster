package com.claudiordese.dto;

public record OrderResponse(
        boolean success,
        String orderId,
        String status,
        String makingAmount,
        String takingAmount,
        String transactionHash
) {}
