package com.claudiordese.session.infrastructure.storage;

import com.claudiordese.exceptions.ServiceUnavailableException;
import com.claudiordese.session.application.port.AvatarStorage;
import com.claudiordese.session.infrastructure.configurations.MinioProperties;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.SetBucketPolicyArgs;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.UUID;

@Component
public class MinioAvatarStorage implements AvatarStorage {

    private static final Logger log = LoggerFactory.getLogger(MinioAvatarStorage.class);

    private final MinioClient client;
    private final MinioProperties props;

    public MinioAvatarStorage(MinioClient client, MinioProperties props) {
        this.client = client;
        this.props = props;
    }

    /** Create the bucket if missing and make it public-read so avatars serve via direct URL. */
    @PostConstruct
    void ensureBucket() {
        try {
            boolean exists = client.bucketExists(
                    BucketExistsArgs.builder().bucket(props.bucket()).build());
            if (!exists) {
                client.makeBucket(MakeBucketArgs.builder().bucket(props.bucket()).build());
            }
            client.setBucketPolicy(SetBucketPolicyArgs.builder()
                    .bucket(props.bucket())
                    .config(publicReadPolicy(props.bucket()))
                    .build());
        } catch (Exception e) {
            // Don't fail startup if MinIO isn't up yet; uploads will surface the error.
            log.warn("MinIO bucket init for '{}' failed: {}", props.bucket(), e.getMessage());
        }
    }

    @Override
    public String store(UUID userId, byte[] content, String contentType) {
        // Unique key per upload → the URL changes each time, so browsers never
        // show a stale cached avatar. (Old objects orphan — a cleanup job later.)
        String key = userId + "/" + UUID.randomUUID() + extension(contentType);
        try (InputStream in = new ByteArrayInputStream(content)) {
            client.putObject(PutObjectArgs.builder()
                    .bucket(props.bucket())
                    .object(key)
                    .stream(in, content.length, -1)
                    .contentType(contentType)
                    .build());
        } catch (Exception e) {
            log.error("Avatar upload to MinIO failed for {}: {}", userId, e.getMessage());
            throw new ServiceUnavailableException("avatar_upload_failed",
                    "Could not store the avatar right now. Please try again.");
        }
        return props.publicUrl() + "/" + props.bucket() + "/" + key;
    }

    private static String extension(String contentType) {
        return switch (contentType == null ? "" : contentType) {
            case "image/png" -> ".png";
            case "image/jpeg" -> ".jpg";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            default -> "";
        };
    }

    private static String publicReadPolicy(String bucket) {
        return """
                {
                  "Version": "2012-10-17",
                  "Statement": [{
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": ["arn:aws:s3:::%s/*"]
                  }]
                }
                """.formatted(bucket);
    }
}
