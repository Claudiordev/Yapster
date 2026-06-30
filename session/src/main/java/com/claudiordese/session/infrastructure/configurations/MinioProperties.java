package com.claudiordese.session.infrastructure.configurations;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param endpoint  the MinIO API endpoint the SDK connects to (internal, e.g. http://minio:9000)
 * @param accessKey MinIO access key
 * @param secretKey MinIO secret key
 * @param bucket    bucket avatars live in
 * @param publicUrl browser-reachable base URL used to build the stored avatar URL
 *                  (may differ from {@code endpoint}, e.g. http://localhost:9000)
 */
@ConfigurationProperties(prefix = "minio")
public record MinioProperties(
        String endpoint,
        String accessKey,
        String secretKey,
        String bucket,
        String publicUrl) {}
