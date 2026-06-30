create table public.refresh_token (revoked boolean not null, expiry_date timestamp(6) with time zone, id uuid not null, token varchar(255), username varchar(255), primary key (id));
create table public.roles (id bigint not null, user_id uuid not null, role varchar(255), primary key (id), constraint roles_idx_1 unique (user_id, role));
create table public.servers (created_at timestamp(6) with time zone not null, id uuid not null, owner_id uuid not null, name varchar(255) not null, primary key (id));
create table public.users (balance numeric(12,2) default 0 not null, enabled boolean default true, id uuid not null, avatar_url varchar(255), email varchar(255) not null unique, password varchar(255) not null, username varchar(255) not null unique, primary key (id));
create sequence roles_seq start with 1 increment by 50;
create table server_members (server_id uuid not null, user_id uuid not null, primary key (server_id, user_id));
alter table if exists public.roles add constraint FK97mxvrajhkq19dmvboprimeg1 foreign key (user_id) references public.users;
alter table if exists server_members add constraint FKqu0vrc783yq288y2r92gjurw2 foreign key (server_id) references public.servers;
