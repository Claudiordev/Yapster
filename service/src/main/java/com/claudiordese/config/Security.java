package com.claudiordese.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class Security {

    @Bean
    public SecurityFilterChain configure(HttpSecurity http) throws Exception{
        http.httpBasic(httpBasic -> httpBasic.disable());

        http.authorizeHttpRequests(authorizeRequests -> authorizeRequests.requestMatchers("/**").permitAll()).formLogin(form->form.disable());

        http.csrf(csrf -> csrf.disable());

        return http.build();
    }
}
