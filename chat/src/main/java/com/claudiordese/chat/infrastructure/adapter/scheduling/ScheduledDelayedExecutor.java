package com.claudiordese.chat.infrastructure.adapter.scheduling;

import com.claudiordese.chat.application.port.scheduling.DelayedExecutor;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class ScheduledDelayedExecutor implements DelayedExecutor {

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "call-presence-batch");
        thread.setDaemon(true);
        return thread;
    });

    @Override
    public void schedule(Runnable task, Duration delay) {
        scheduler.schedule(task, delay.toMillis(), TimeUnit.MILLISECONDS);
    }

    @PreDestroy
    void shutdown() {
        scheduler.shutdownNow();
    }
}
