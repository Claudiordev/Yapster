package com.claudiordese.session.infrastructure.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Puts the shared-secret check in front of everything under {@code <base-path>/internal/}. */
@Configuration
public class InternalSecretWebConfig implements WebMvcConfigurer {

    private final InternalSecretInterceptor interceptor;
    private final String basePath;

    public InternalSecretWebConfig(InternalSecretInterceptor interceptor,
                                   @Value("${url.api.base-path}") String basePath) {
        this.interceptor = interceptor;
        this.basePath = basePath;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor).addPathPatterns(basePath + "/internal/**");
    }
}
