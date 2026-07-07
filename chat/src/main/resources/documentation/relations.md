erDiagram
    CONVERSATION ||--o{ CONVERSATION_MEMBER : has
    CONVERSATION ||--o{ MESSAGE : contains
    CONVERSATION {
        uuid id PK
        string type
        string name
        string dm_key UK
        timestamptz created_at
    }

    CONVERSATION_MEMBER {
    uuid conversation_id PK_FK
    uuid user_id PK
    bigint last_read_seq
    }
MESSAGE {
uuid id PK
uuid conversation_id FK
uuid sender_id
text body
timestamptz sent_at
bigint seq UK
}
