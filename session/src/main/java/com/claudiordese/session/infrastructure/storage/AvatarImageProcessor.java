package com.claudiordese.session.infrastructure.storage;

import com.claudiordese.exceptions.BadRequestException;
import net.coobird.thumbnailator.Thumbnails;
import net.coobird.thumbnailator.geometry.Positions;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Normalises an uploaded avatar before it is stored: square center-crop, downscale
 * to a sane master size, and re-encode as JPEG at good quality.
 *
 * Why: users upload arbitrary images (e.g. a 2 MB PNG). Stored as-is they're huge
 * and non-square, so icons render slowly and get clipped/blurry. A 256² JPEG is a
 * few tens of KB, stays sharp at icon sizes on 2–3× (retina) screens, and has a
 * consistent square shape the UI can crop cleanly with {@code object-fit: cover}.
 */
@Component
public class AvatarImageProcessor {

    /** Master edge length in px. 256 is crisp for small icons at high DPR and tiny as JPEG. */
    private static final int SIZE = 256;
    /** JPEG quality 0..1 — 0.85 is visually lossless for photos at this size. */
    private static final double QUALITY = 0.85;

    public ProcessedImage process(byte[] input) {
        if (input == null || input.length == 0) {
            throw new BadRequestException("invalid_image", "No image data was uploaded");
        }
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Thumbnails.of(new ByteArrayInputStream(input))
                    .size(SIZE, SIZE)
                    .crop(Positions.CENTER)     // "cover": scale to fill the square, then centre-crop
                    .outputFormat("jpg")
                    .outputQuality(QUALITY)
                    .toOutputStream(out);

            byte[] processed = out.toByteArray();
            if (processed.length == 0) {
                throw new BadRequestException("invalid_image", "Uploaded file is not a readable image");
            }
            return new ProcessedImage(processed, "image/jpeg");
        } catch (IOException e) {
            // Thumbnailator throws IOException when the bytes aren't a decodable image.
            throw new BadRequestException("invalid_image", "Uploaded file is not a readable image");
        }
    }

    /** Normalised image ready for storage. */
    public record ProcessedImage(byte[] content, String contentType) {}
}
