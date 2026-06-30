package com.claudiordese.security.config;

import com.claudiordese.exceptions.GlobalExceptionControllerAdvice;
import com.claudiordese.utils.ProblemDetails;
import com.claudiordese.filters.JwtFilter;
import com.claudiordese.security.JwtValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.io.IOException;

@AutoConfiguration
@ConditionalOnClass({SecurityFilterChain.class, HttpSecurity.class})
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@ConditionalOnProperty(prefix = "security.jwt", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(JwtSecurityProperties.class)
@Import(GlobalExceptionControllerAdvice.class)
public class JwtSecurityAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public JwtValidator jwtValidator(JwtSecurityProperties properties) {
        return new JwtValidator(properties.getPublicKeyPath());
    }

    /**
     * Prometheus scrapes hit this endpoint every ~15s on every service.
     * Bypassing the security filter chain keeps the scrapes out of DEBUG
     * security logs without lowering log verbosity for real requests.
     */
    @Bean
    @ConditionalOnMissingBean(name = "metricsScrapeIgnoringCustomizer")
    public WebSecurityCustomizer metricsScrapeIgnoringCustomizer() {
        return web -> web.ignoring().requestMatchers("/actuator/prometheus");
    }

    @Bean
    @ConditionalOnMissingBean(name = "jwtAuthenticationEntryPoint")
    public AuthenticationEntryPoint jwtAuthenticationEntryPoint(ObjectMapper mapper) {
        return (req, res, ex) -> writeProblem(res, mapper, HttpStatus.UNAUTHORIZED,
                "unauthorized", "Authentication required", req.getRequestURI());
    }

    @Bean
    @ConditionalOnMissingBean(name = "jwtAccessDeniedHandler")
    public AccessDeniedHandler jwtAccessDeniedHandler(ObjectMapper mapper) {
        return (req, res, ex) ->
                writeProblem(res, mapper, HttpStatus.FORBIDDEN, "forbidden", "Access denied", req.getRequestURI());
    }

    @Bean
    @ConditionalOnMissingBean
    public SecurityFilterChain jwtSecurityFilterChain(
            HttpSecurity http,
            JwtValidator jwtValidator,
            AuthenticationEntryPoint jwtAuthenticationEntryPoint,
            AccessDeniedHandler jwtAccessDeniedHandler,
            JwtSecurityProperties properties) throws Exception {

        JwtFilter jwtFilter = new JwtFilter(jwtValidator, properties);

        http.httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> {
                properties.getPublicPaths()
                        .forEach(p -> auth.requestMatchers(p).permitAll());
                properties.getAuthenticatedPaths()
                        .forEach(p -> auth.requestMatchers(p).authenticated());
                auth.anyRequest().denyAll();
            })
            .exceptionHandling(e -> e
                    .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                    .accessDeniedHandler(jwtAccessDeniedHandler))
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private static void writeProblem(HttpServletResponse response,
                                     ObjectMapper mapper,
                                     HttpStatus status,
                                     String code,
                                     String detail,
                                     String instance) throws IOException {
        ProblemDetail problem = ProblemDetails.of(status, code, detail, instance);

        response.setStatus(status.value());
        if (status == HttpStatus.UNAUTHORIZED) {
            response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        }
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        mapper.writeValue(response.getWriter(), problem);
    }
}
