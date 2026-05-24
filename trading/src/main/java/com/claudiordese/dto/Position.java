package com.claudiordese.dto;

public record Position(
        long blockId,
        String tokenId,
        String side,
        double entryPrice,
        double shares,
        long openedAtMs,
        String closeReason,
        double closePrice,
        long closedAtMs
) {
    public Position(long blockId, String tokenId, String side, double entryPrice, double shares, long openedAtMs) {
        this(blockId, tokenId, side, entryPrice, shares, openedAtMs, null, 0, 0);
    }

    public Position close(String reason, double closePrice) {
        return new Position(blockId, tokenId, side, entryPrice, shares, openedAtMs, reason, closePrice, System.currentTimeMillis());
    }
}
