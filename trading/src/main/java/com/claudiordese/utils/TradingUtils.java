package com.claudiordese.utils;

import com.claudiordese.dto.PriceTick;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.springframework.stereotype.Component;

import java.util.Deque;
import java.util.concurrent.ConcurrentLinkedDeque;

@Component
@Data
@Getter
@Setter
public class TradingUtils {
    private final Deque<PriceTick> priceHistory = new ConcurrentLinkedDeque<>();
}
