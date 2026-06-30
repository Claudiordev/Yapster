package com.claudiordese.utils;

/**
 * Shared math utility functions for rounding and token decimal conversions.
 */
public final class MathUtils {

    private static final int TOKEN_DECIMALS = 6;

    private MathUtils() {}

    /**
     * Rounds a value down (floor) to the specified number of decimal places.
     * Example: roundDown(1.5678, 2) = 1.56
     */
    public static double roundDown(double x, int decimals) {
        double factor = Math.pow(10, decimals);
        return Math.floor(x * factor) / factor;
    }

    /**
     * Rounds a value to the nearest integer at the specified decimal place.
     * Example: roundNormal(1.565, 2) = 1.57
     */
    public static double roundNormal(double x, int decimals) {
        double factor = Math.pow(10, decimals);
        return Math.round(x * factor) / factor;
    }

    /**
     * Converts a human-readable token amount to on-chain representation
     * using 6 decimal places (USDC/Polymarket standard).
     * USDC tokens don't use decimals on-chain.
     * They use integers where 6 decimal places are implied.
     * This is a blockchain standard, smart contracts work with integers, not floats.
     *   Human-readable  →  On-chain integer
     *   $1.50           →  1,500,000
     *   $0.01           →  10,000
     *   $1.00           →  1,000,000
     * Example: toTokenDecimals(1.5) = 1500000 = Math.pow(10^6) = 1,000,000 * 1.5
     */
    public static long toTokenDecimals(double x) {
        double f = Math.pow(10, TOKEN_DECIMALS) * x;
        return Math.round(f);
    }
}
