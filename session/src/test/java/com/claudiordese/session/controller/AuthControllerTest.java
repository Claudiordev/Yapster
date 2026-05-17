package com.claudiordese.session.controller;

import com.claudiordese.session.controllers.AuthController;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class AuthControllerTest {

    @Autowired
    private AuthController authController;

    @Test
    void shouldExist() {
        Assertions.assertThat(authController).isNotNull();
    }
}
