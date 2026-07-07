CREATE TABLE conversation (
    id UUID PRIMARY KEY,
    type VARCHAR(16) NOT NULL,
    name VARCHAR(128),
    dm_key VARCHAR(128) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE conversation_member (
    conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    last_read_seq BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_member_user ON conversation_member(user_id);

CREATE TABLE message (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    body TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL,
    seq BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE
);

CREATE INDEX idx_message_conv_seq ON message(conversation_id, seq DESC);