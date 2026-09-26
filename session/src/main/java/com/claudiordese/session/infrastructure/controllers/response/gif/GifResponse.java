package com.claudiordese.session.infrastructure.controllers.response.gif;

import com.claudiordese.session.application.domain.GifFavorite;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "A saved GIF.")
public record GifResponse(
        @Schema(description = "The GIF's id at its provider.") String id,
        @Schema(description = "Title.", example = "Happy cat") String title,
        @Schema(description = "Small preview link.") String previewUrl,
        @Schema(description = "Link that is sent in chat.") String url) {

    public static GifResponse from(GifFavorite gif) {
        return new GifResponse(gif.gifId(), gif.title(), gif.previewUrl(), gif.url());
    }
}
