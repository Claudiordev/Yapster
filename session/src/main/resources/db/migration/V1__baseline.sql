CREATE TABLE public.refresh_token (
    revoked     BOOLEAN NOT NULL,
    expiry_date TIMESTAMP(6) WITH TIME ZONE,
    id          UUID NOT NULL,
    token       VARCHAR(255),
    username    VARCHAR(255),
    PRIMARY KEY (id)
);

CREATE TABLE public.roles (
    id      BIGINT NOT NULL,
    user_id UUID NOT NULL,
    role    VARCHAR(255),
    PRIMARY KEY (id),
    CONSTRAINT roles_idx_1 UNIQUE (user_id, role)
);

CREATE TABLE public.servers (
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    id         UUID NOT NULL,
    owner_id   UUID NOT NULL,
    name       VARCHAR(255) NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE public.users (
    balance    NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    enabled    BOOLEAN DEFAULT TRUE,
    id         UUID NOT NULL,
    avatar_url VARCHAR(255),
    email      VARCHAR(255) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    username   VARCHAR(255) NOT NULL UNIQUE,
    PRIMARY KEY (id)
);

CREATE SEQUENCE roles_seq
    START WITH 1
    INCREMENT BY 50;

CREATE TABLE server_members (
    server_id UUID NOT NULL,
    user_id   UUID NOT NULL,
    PRIMARY KEY (server_id, user_id)
);

ALTER TABLE IF EXISTS public.roles
    ADD CONSTRAINT FK97mxvrajhkq19dmvboprimeg1
        FOREIGN KEY (user_id) REFERENCES public.users;

ALTER TABLE IF EXISTS server_members
    ADD CONSTRAINT FKqu0vrc783yq288y2r92gjurw2
        FOREIGN KEY (server_id) REFERENCES public.servers;
