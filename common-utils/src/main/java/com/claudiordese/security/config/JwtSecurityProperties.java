package com.claudiordese.security.config;

import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;
import java.util.stream.Stream;

@Data
@Getter
@Setter
@ConfigurationProperties(prefix = "security.jwt")
public class JwtSecurityProperties {

    private boolean enabled = true;
    private String publicKeyPath = "keys/public.pem";
    private List<String> publicPaths = List.of(
            "/public/**",
            "/actuator/beans",
            "/actuator/info",
            "/actuator/health",
            "/actuator/health/**",
            "/error",
            "/v3/api-docs/**",
            "/swagger-ui/**",
            "/swagger-ui.html"
    );
    private List<String> authenticatedPaths = List.of();
    private String rolesClaim = "roles";
    private String rolePrefix = "ROLE_";
    private long accessExpirationMs = 900_000L;
    private long refreshExpirationMs = 2_592_000_000L;
    public List<String> additionalPublicPaths = List.of();

    @PostConstruct
    void mergePublicPaths() {
        this.publicPaths = Stream.concat(
                publicPaths.stream(),
                additionalPublicPaths.stream()
        ).toList();
    }
}
