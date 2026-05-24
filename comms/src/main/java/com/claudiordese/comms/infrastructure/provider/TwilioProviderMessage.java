package com.claudiordese.comms.infrastructure.provider;

import com.fasterxml.jackson.annotation.JsonProperty;

record TwilioProviderMessage(
        String sid,
        @JsonProperty("date_sent") String dateSent,
        String body,
        String to,
        String price,
        @JsonProperty("price_unit") String priceUnit,
        String status) {}
