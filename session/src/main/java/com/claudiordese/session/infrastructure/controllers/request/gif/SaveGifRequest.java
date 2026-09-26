package com.claudiordese.session.infrastructure.controllers.request.gif;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "A GIF to save into a folder: our own copy of where it lives.")
public record SaveGifRequest(

        @Size(max = 120)
        @Schema(description = "GIF title, used for searching inside the folder.", example = "Happy cat")
        String title,

        @NotBlank
        @Size(max = 500)
        @Schema(description = "Small preview link (https, on a supported GIF host).")
        String previewUrl,

        @NotBlank
        @Size(max = 500)
        @Schema(description = "Link that is sent in chat (https, on a supported GIF host).")
        String url) {}
