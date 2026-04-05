package com.claudiordese.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class PositionManager {

    private static final Logger logger = LoggerFactory.getLogger(PositionManager.class);

    private final Map<String, Position> openPositions = new ConcurrentHashMap<>();
    private final List<Position> closedPositions = new CopyOnWriteArrayList<>();

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

    public void openPosition(long blockId, String tokenId, String side, double entryPrice, double shares) {
        Position pos = new Position(blockId, tokenId, side, entryPrice, shares, System.currentTimeMillis());
        openPositions.put(tokenId, pos);
        logger.info("POSITION OPENED | block={} | side={} | token={} | entry={} | shares={}",
                blockId, side, tokenId, entryPrice, shares);
    }

    public Position getPosition(String tokenId) {
        return openPositions.get(tokenId);
    }

    public List<Position> getOpenPositions() {
        return List.copyOf(openPositions.values());
    }

    public List<Position> getClosedPositions() {
        return List.copyOf(closedPositions);
    }

    public void clearPositions() {
        openPositions.clear();
        logger.warn("Positions cleared.");
    }

    public Position closePosition(String tokenId, String reason, double closePrice) {
        Position pos = openPositions.remove(tokenId);
        if (pos == null) return null;
        Position closed = pos.close(reason, closePrice);
        closedPositions.add(closed);
        logger.warn("POSITION CLOSED | block={} | side={} | reason={} | entry={} | close={} | P/L={}",
                closed.blockId(), closed.side(), reason, closed.entryPrice(), closePrice,
                String.format("%.4f", closePrice - closed.entryPrice()));
        return closed;
    }

    public boolean hasOpenPosition(String tokenId) {
        return openPositions.containsKey(tokenId);
    }
}
