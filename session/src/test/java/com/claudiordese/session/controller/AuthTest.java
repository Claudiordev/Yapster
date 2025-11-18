package com.claudiordese.session.controller;

import com.claudiordese.session.controllers.Auth;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class AuthTest {

    @Autowired
    private Auth auth;

    @Test
    void shouldExist() {
        Assertions.assertThat(auth).isNotNull();
    }
}
