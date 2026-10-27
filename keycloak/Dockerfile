FROM quay.io/keycloak/keycloak:26.0

# BCrypt password hashing SPI, so Spring BCrypt hashes ($2a$...) from the old session DB can be imported.
ADD --chmod=644 https://github.com/leroyguillaume/keycloak-bcrypt/releases/download/v1.7.0/keycloak-bcrypt-1.7.0.jar /opt/keycloak/providers/

# `start` (production mode) needs the providers baked into the optimized build.
RUN /opt/keycloak/bin/kc.sh build
