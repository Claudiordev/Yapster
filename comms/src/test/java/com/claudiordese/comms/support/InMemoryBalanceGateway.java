package com.claudiordese.comms.support;

import com.claudiordese.comms.application.port.BalanceGateway;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

public class InMemoryBalanceGateway implements BalanceGateway {

    private final Map<String, BigDecimal> balances = new HashMap<>();

    public InMemoryBalanceGateway set(String username, BigDecimal balance) {
        balances.put(username, balance);
        return this;
    }

    @Override
    public BigDecimal balanceOf(String username) {
        return balances.getOrDefault(username, BigDecimal.ZERO);
    }
}
