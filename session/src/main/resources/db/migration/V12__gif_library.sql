-- Saved GIFs. Every user has one default "Favorites" folder (created on first use); premium
-- users can add more. A GIF may sit in several folders; deleting a folder deletes its entries.
CREATE TABLE gif_folders (
    id         UUID         NOT NULL PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       VARCHAR(30)  NOT NULL,
    is_default BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_gif_folders_user_name ON gif_folders (user_id, lower(name));
CREATE UNIQUE INDEX uq_gif_folders_user_default ON gif_folders (user_id) WHERE is_default;

CREATE TABLE gif_favorites (
    id          UUID         NOT NULL PRIMARY KEY,
    folder_id   UUID         NOT NULL REFERENCES gif_folders (id) ON DELETE CASCADE,
    gif_id      VARCHAR(64)  NOT NULL,
    title       VARCHAR(120) NOT NULL,
    preview_url VARCHAR(500) NOT NULL,
    url         VARCHAR(500) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_gif_favorites_folder_gif UNIQUE (folder_id, gif_id)
);
