-- Avatars are now MinIO object URLs, which can exceed 255 chars.
ALTER TABLE users ALTER COLUMN avatar_url TYPE VARCHAR(500);
