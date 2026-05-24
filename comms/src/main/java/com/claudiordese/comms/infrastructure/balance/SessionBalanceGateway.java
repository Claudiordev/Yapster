package com.claudiordese.comms.infrastructure.balance;

import com.claudiordese.comms.application.port.BalanceGateway;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class SessionBalanceGateway implements BalanceGateway {

    private final SessionClient sessionClient;

    SessionBalanceGateway(SessionClient sessionClient) {
        this.sessionClient = sessionClient;
    }

    @Override
    public BigDecimal balanceOf(String username) {
        return sessionClient.getBalance(username);
    }
}
