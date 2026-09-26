-- The composer's GIF button, seeded on so it keeps working until an admin switches it off.
INSERT INTO feature_flags (name, enabled) VALUES ('gif', TRUE)
ON CONFLICT (name) DO NOTHING;
