package com.claudiordese.config;

import com.claudiordese.service.OrderService;
import com.claudiordese.service.PositionManager;
import com.claudiordese.service.StopLossWebSocketHandler;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.context.annotation.Configuration;

@Configuration
public class StopLossConfig {

    private final OrderService orderService;
    private final PositionManager positionManager;
    private final StopLossWebSocketHandler stopLossHandler;

    public StopLossConfig(OrderService orderService,
                          PositionManager positionManager,
                          StopLossWebSocketHandler stopLossHandler) {
        this.orderService = orderService;
        this.positionManager = positionManager;
        this.stopLossHandler = stopLossHandler;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void wireUpDependencies() {
        orderService.setPositionManager(positionManager);
        orderService.setStopLossHandler(stopLossHandler);
    }
}
