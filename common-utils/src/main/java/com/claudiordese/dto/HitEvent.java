package com.claudiordese.dto;

public record HitEvent(
        long blockId,
        double hitPrice,
        double targetPrice,
        String hitDiff,
        String hitTime,
        double hitAvgPerSec,
        double hitAverage5Ticks,
        double finalPrice,
        String finalDiff,
        String finalTime,
        double finalAvgPerSec,
        double finalAverage5Ticks
) {}
