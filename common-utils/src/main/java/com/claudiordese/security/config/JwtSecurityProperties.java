package com.claudiordese.security.config;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@Data
@Getter
@Setter
@ConfigurationProperties(prefix = "security.jwt")
public class JwtSecurityProperties {

    private boolean enabled = true;
    private String publicKeyPath = "keys/public.pem";
    private List<String> publicPaths = List.of(
            "/public/**",
            "/actuator/health",
            "/actuator/health/**",
            "/error"
    );
    private List<String> authenticatedPaths = List.of("/api/**");
    private String rolesClaim = "roles";
    private String rolePrefix = "ROLE_";
    private long accessExpirationMs = 900_000L;
    private long refreshExpirationMs = 2_592_000_000L;
}
