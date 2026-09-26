package com.claudiordese.chat.application.port.scheduling;

import java.time.Duration;

/** Runs a task once after a delay (a port so batching can be tested without real time). */
public interface DelayedExecutor {
    void schedule(Runnable task, Duration delay);
}
