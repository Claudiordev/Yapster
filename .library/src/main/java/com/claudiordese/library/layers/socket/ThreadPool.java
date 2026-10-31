package com.claudiordese.library.layers.socket;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

@Service
public class ThreadPool {
    private Logger logger = LoggerFactory.getLogger(ThreadPool.class);
    private ExecutorService executorService = Executors.newFixedThreadPool(1);


    public ThreadPool() {
    }

    public void run() {
        for (int i = 0; i < 10; i++) {
            int taskId = i;

            executorService.submit(() -> {
                logger.info("Thread running on thread pool, task id: {} on thread {}", taskId, Thread.currentThread().getName());

                //Runs each task within 1000ms
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    logger.error(e.getMessage());
                }
            });
        }
    }

    public void runAsync() {
        Callable<String> callable = () -> {
            Thread.sleep(1000);
            return "Result";
        };

        Future<String> future = executorService.submit(callable);
    }
}
