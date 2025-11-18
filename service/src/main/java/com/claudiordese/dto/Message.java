package com.claudiordese.dto;

public record Message(
        String date_sent,
        String body,
        String to,
        String price,
        String price_unit,
        String status) {
}
