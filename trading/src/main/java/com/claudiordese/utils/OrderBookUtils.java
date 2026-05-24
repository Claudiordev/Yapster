package com.claudiordese.utils;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Utility methods for parsing order book data from the Polymarket CLOB.
 */
public final class OrderBookUtils {

    private OrderBookUtils() {}

    /**
     * Finds the highest price from a JSON array of bid entries.
     * @param bids JSON array where each element has a "price" field
     * @return the highest bid price, or 0 if bids is null/empty
     */
    public static double findBestBid(JsonNode bids) {
        if (bids == null || bids.isEmpty()) return 0;
        double bestBid = 0;
        for (JsonNode bid : bids) {
            double price = bid.get("price").asDouble();
            if (price > bestBid) bestBid = price;
        }
        return bestBid;
    }
}
