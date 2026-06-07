package com.claudiordese;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.claudiordese")
public class Comms {
    public static void main(String[] args) {
        SpringApplication.run(Comms.class, args);
    }
}
