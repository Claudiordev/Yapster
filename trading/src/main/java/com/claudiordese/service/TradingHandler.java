package com.claudiordese.service;

import com.claudiordese.dto.HitEvent;
import com.claudiordese.dto.PriceTick;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Deque;
import java.util.concurrent.ConcurrentLinkedDeque;

@Service
public class TradingHandler {

    private static final Logger logger = LoggerFactory.getLogger(TradingHandler.class);
    private static final long FIVE_MINUTES_MS = 5 * 60 * 1000;
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");

    private PositionManager positionManager;
    private final TradingProducer tradingProducer;
    private final OrderService orderService;
    private final Deque<PriceTick> priceHistory = new ConcurrentLinkedDeque<>();

    @Value("${trading.feature.price.threshold}")
    private volatile double priceThreshold;

    @Value("${trading.feature.timeMs.threshold}")
    private volatile long timeThreshold;

    @Value("${trading.feature.stopLoss.percent:20.0}")
    private volatile double stopLossPercent;

    @Value("${trading.feature.takeProfit.percent:20.0}")
    private volatile double takeProfitPercent;

    public double getPriceThreshold() { return priceThreshold; }
    public void setPriceThreshold(double priceThreshold) { this.priceThreshold = priceThreshold; }
    public long getTimeThreshold() { return timeThreshold; }
    public void setTimeThreshold(long timeThreshold) { this.timeThreshold = timeThreshold; }
    public double getStopLossPercent() { return stopLossPercent; }
    public void setStopLossPercent(double stopLossPercent) { this.stopLossPercent = stopLossPercent; }
    public double getTakeProfitPercent() { return takeProfitPercent; }
    public void setTakeProfitPercent(double takeProfitPercent) { this.takeProfitPercent = takeProfitPercent; }

    private double targetPrice;
    private long currentBlockMs;
    private boolean firstBlock = true;
    private boolean hitFired;
    private boolean hitSent;

    // Saved hit values at the moment the threshold was crossed
    private long pendingBlockId;
    private double pendingHitPrice;
    private String pendingHitDiff;
    private String pendingHitTime;
    private double pendingHitAvgPerSec;
    private double pendingHitAvg5Tick;

    public TradingHandler(@org.springframework.lang.Nullable TradingProducer tradingProducer,
                          OrderService orderService, PositionManager positionManager) {
        this.tradingProducer = tradingProducer;
        this.orderService = orderService;
        this.positionManager = positionManager;
    }

    public void handle(double price, long timestampMs) {
        long nextBlockMs = ((timestampMs / FIVE_MINUTES_MS) + 1) * FIVE_MINUTES_MS;

        if (currentBlockMs != nextBlockMs) {
            positionManager.clearPositions();
            if (currentBlockMs != 0) firstBlock = false;
            targetPrice = price;
            currentBlockMs = nextBlockMs;
            hitFired = false;
            hitSent = false;
        }

        // Track price history for last 5 minutes
        priceHistory.addLast(new PriceTick(price, timestampMs));
        long cutoff = timestampMs - FIVE_MINUTES_MS;
        while (!priceHistory.isEmpty() && priceHistory.peekFirst().timestampMs() < cutoff) {
            priceHistory.pollFirst();
        }

        // Calculate avg change per second
        double avgPerSec = 0;
        if (priceHistory.size() >= 2) {
            double totalChange = 0;
            PriceTick prev = null;
            for (PriceTick tick : priceHistory) {
                if (prev != null) {
                    totalChange += Math.abs(tick.price() - prev.price());
                }
                prev = tick;
            }
            PriceTick first = priceHistory.peekFirst();
            PriceTick last = priceHistory.peekLast();
            double elapsedSec = (last.timestampMs() - first.timestampMs()) / 1000.0;
            if (elapsedSec > 0) avgPerSec = totalChange / elapsedSec;
        }

        // Calculate avg change over last 5 ticks (signed: + means rising, - means falling)
        double avg5Tick = 0;
        if (priceHistory.size() >= 2) {
            var it = priceHistory.descendingIterator();
            double total = 0;
            int count = 0;
            double prevPrice = it.next().price();
            while (it.hasNext() && count < 5) {
                double p = it.next().price();
                total += prevPrice - p;
                prevPrice = p;
                count++;
            }
            if (count > 0) avg5Tick = total / count;
        }

        long remainingMs = nextBlockMs - timestampMs;
        long minutes = (remainingMs / 1000) / 60;
        long seconds = (remainingMs / 1000) % 60;

        double diff = price - targetPrice;
        String diffStr = String.format("%s%.2f", diff >= 0 ? "+" : "", diff);

        String currentTime = ZonedDateTime.ofInstant(Instant.ofEpochMilli(timestampMs), ZoneId.systemDefault()).format(TIME_FMT);
        String nextBlockTime = ZonedDateTime.ofInstant(Instant.ofEpochMilli(nextBlockMs), ZoneId.systemDefault()).format(TIME_FMT);

        String avg5TickStr = String.format("%s%.2f", avg5Tick >= 0 ? "+" : "", avg5Tick);

            System.out.printf("ID: %d | BTC/USD: %.2f | Target: %.2f | Diff: %s | Avg/s: %.2f | Average5Ticks: %s | Ticks: %d | Time: %s | Next 5m block: %s | Countdown: %dm %ds%n",
                    (nextBlockMs - FIVE_MINUTES_MS) / 1000, price, targetPrice, diffStr, avgPerSec, avg5TickStr, priceHistory.size(),
                    currentTime, nextBlockTime, minutes, seconds);

        // Save hit values when threshold is crossed
        if (!firstBlock && !hitFired && remainingMs <= timeThreshold && Math.abs(diff) >= priceThreshold) {
            hitFired = true;
            pendingBlockId = (nextBlockMs - FIVE_MINUTES_MS) / 1000;
            pendingHitPrice = price;
            pendingHitDiff = diffStr;
            pendingHitTime = currentTime;
            pendingHitAvgPerSec = avgPerSec;
            pendingHitAvg5Tick = avg5Tick;

            boolean up = diff > 0;
            logger.warn("HIT PENDING | ID: {} | Price diff: {} | BTC/USD: {} | Target: {} | Side: {} | Avg/s: {} | Average5Ticks: {}",
                    pendingBlockId, diffStr, price, targetPrice, up ? "Up" : "Down", avgPerSec, avg5Tick);

            // Place $1 order: Up if price went up, Down if price went down
            orderService.placeOrder(pendingBlockId, up);
        }

        // Send to Kafka at 1 second before the 5-minute block ends
        if (hitFired && !hitSent && remainingMs <= 1000) {
            hitSent = true;
            String finalDiff = String.format("%s%.2f", diff >= 0 ? "+" : "", diff);
            var hitEvent = new HitEvent(pendingBlockId, pendingHitPrice, targetPrice, pendingHitDiff, pendingHitTime,
                    pendingHitAvgPerSec, pendingHitAvg5Tick, price, finalDiff, currentTime, avgPerSec, avg5Tick);
            if (tradingProducer != null) logger.warn("HIT SENT | ID: {} | Hit price: {} ({}) Avg/s: {} Average5Ticks: {} | Final price: {} ({}) Avg/s: {} Average5Ticks: {} | Target: {}",
                        pendingBlockId, pendingHitPrice, pendingHitDiff, pendingHitAvgPerSec, pendingHitAvg5Tick, price, finalDiff, avgPerSec, avg5Tick, targetPrice);

            if (tradingProducer != null) tradingProducer.send(hitEvent);
        }
    }
}
