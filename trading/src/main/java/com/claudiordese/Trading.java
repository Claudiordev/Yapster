package com.claudiordese;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.claudiordese")
public class Trading {

    public static void main(String[] args) {
        SpringApplication.run(Trading.class, args);
    }
}
