package com.claudiordese.comms.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.math.BigDecimal;

@FeignClient(name = "SESSION")
public interface SessionClient {

    @GetMapping("/api/v1/auth/user/balance/{username}")
    BigDecimal getBalance(@PathVariable("username") String username);
}
