package com.claudiordese.comms.application.port;

import java.math.BigDecimal;

public interface BalanceGateway {
    BigDecimal balanceOf(String username);
}
