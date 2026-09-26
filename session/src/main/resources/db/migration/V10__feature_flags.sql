-- Admin-toggled feature switches. New features are added by a migration; the API can only flip existing rows.
CREATE TABLE feature_flags (
    name    VARCHAR(64) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE
);

-- Seeded to match what the menu showed before the switches existed.
INSERT INTO feature_flags (name, enabled) VALUES
    ('game-servers', FALSE),
    ('events', TRUE),
    ('premium', TRUE);
