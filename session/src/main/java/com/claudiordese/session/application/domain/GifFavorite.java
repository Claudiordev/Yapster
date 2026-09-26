package com.claudiordese.session.application.domain;

import java.time.Instant;

/** A saved GIF: our own copy of where it lives, so it still shows without asking the provider. */
public record GifFavorite(String gifId, String title, String previewUrl, String url, Instant createdAt) {}
