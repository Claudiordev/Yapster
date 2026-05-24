package com.claudiordese.comms.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ProviderMessage(
        String sid,
        @JsonProperty("date_sent") String dateSent,
        String body,
        String to,
        String price,
        @JsonProperty("price_unit") String priceUnit,
        String status) {}
