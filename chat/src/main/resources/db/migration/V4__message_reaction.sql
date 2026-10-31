CREATE TABLE message_reaction (
    message_id UUID NOT NULL REFERENCES message(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    emoji VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (message_id, user_id, emoji)
);
