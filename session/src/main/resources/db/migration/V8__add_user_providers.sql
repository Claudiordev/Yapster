-- External login providers (Google today, others later). A user can have several,
-- and can also keep a password. Accounts created through a provider have no password.
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

CREATE TABLE user_providers (
    id         UUID         NOT NULL PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider   VARCHAR(32)  NOT NULL,
    -- The provider's permanent id for the account (Google: the ID token's "sub"),
    -- NOT the email, which can change or be reused.
    subject    VARCHAR(255) NOT NULL,
    email      VARCHAR(255),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_providers_provider_subject UNIQUE (provider, subject)
);

CREATE INDEX idx_user_providers_user ON user_providers (user_id);
