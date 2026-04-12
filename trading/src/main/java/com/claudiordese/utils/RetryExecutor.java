package com.claudiordese.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.function.Supplier;

public final class RetryExecutor {

    private static final Logger logger = LoggerFactory.getLogger(RetryExecutor.class);

    public static final int MAX_RETRIES = 5;
    private static final long RETRY_DELAY_MS = 1000;

    private RetryExecutor() {}

    public static boolean execute(String label, Supplier<Boolean> action) {
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            logger.warn("{} attempt {}/{}", label, attempt, MAX_RETRIES);
            if (Boolean.TRUE.equals(action.get())) return true;
            if (attempt < MAX_RETRIES) {
                try {
                    Thread.sleep(RETRY_DELAY_MS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return false;
                }
            }
        }
        logger.error("{} EXHAUSTED all {} retries", label, MAX_RETRIES);
        return false;
    }
}
