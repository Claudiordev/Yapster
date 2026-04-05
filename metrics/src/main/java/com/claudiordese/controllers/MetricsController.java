package com.claudiordese.controllers;

import com.claudiordese.dto.HitEvent;
import com.claudiordese.dto.OrderEvent;
import com.claudiordese.enums.OrderStatus;
import com.claudiordese.service.HitConsumer;
import com.claudiordese.service.OrderConsumer;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/metrics")
public class MetricsController {

    private final OrderConsumer orderConsumer;
    private final HitConsumer hitConsumer;

    public MetricsController(OrderConsumer orderConsumer, HitConsumer hitConsumer) {
        this.orderConsumer = orderConsumer;
        this.hitConsumer = hitConsumer;
    }

    @GetMapping("/orders")
    public ResponseEntity<?> getOrders(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean successful) {
        List<OrderEvent> result = orderConsumer.getAllOrders();

        if (status != null) {
            try {
                OrderStatus orderStatus = OrderStatus.fromString(status);
                result = result.stream()
                        .filter(o -> o.status().equalsIgnoreCase(orderStatus.name()))
                        .toList();
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", e.getMessage()
                ));
            }
        }

        if (successful != null) {
            result = result.stream()
                    .filter(o -> o.success() == successful)
                    .toList();
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/hits")
    public ResponseEntity<List<HitEvent>> getHits() {
        return ResponseEntity.ok(hitConsumer.getAllHits());
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary() {
        List<OrderEvent> allOrders = orderConsumer.getAllOrders();
        long successful = allOrders.stream().filter(OrderEvent::success).count();
        long failed = allOrders.stream().filter(o -> !o.success()).count();

        return ResponseEntity.ok(Map.of(
                "totalOrders", allOrders.size(),
                "successfulOrders", successful,
                "failedOrders", failed,
                "totalHits", hitConsumer.getAllHits().size()
        ));
    }
}
