package com.claudiordese.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record TradeData(
        String symbol,
        BigDecimal price,
        BigDecimal volume,
        Instant timestamp
) {}
