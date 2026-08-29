package com.claudiordese.session.infrastructure.configurations;

import com.claudiordese.session.application.config.FileUploadRateLimitPolicy;
import com.claudiordese.session.application.config.LoginRateLimitPolicy;
import com.claudiordese.session.application.config.RegisterRateLimitPolicy;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(RateLimitingProperties.class)
public class RateLimitingConfig {

    @Bean
    public LoginRateLimitPolicy loginRateLimitPolicy(RateLimitingProperties properties) {
        return new LoginRateLimitPolicy(
                properties.login().maxAttempts(),
                properties.login().window());
    }

    @Bean
    public RegisterRateLimitPolicy registerRateLimitPolicy(RateLimitingProperties properties) {
        return new RegisterRateLimitPolicy(
                properties.register().maxAttempts(),
                properties.register().window());
    }

    @Bean
    public FileUploadRateLimitPolicy fileUploadRateLimitPolicy(RateLimitingProperties properties) {
        return new FileUploadRateLimitPolicy(
                properties.fileUpload().maxAttempts(),
                properties.fileUpload().window());
    }
}
