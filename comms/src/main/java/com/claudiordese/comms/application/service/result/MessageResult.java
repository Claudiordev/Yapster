package com.claudiordese.comms.application.service.result;

public record MessageResult(
        String providerId,
        String status,
        String price,
        String priceUnit
) {}
