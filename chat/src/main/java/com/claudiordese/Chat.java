package com.claudiordese;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.claudiordese")
public class Chat {
    public static void main(String[] args) {
        SpringApplication.run(Chat.class, args);
    }
}
