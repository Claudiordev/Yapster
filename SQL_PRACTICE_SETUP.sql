-- =============================================================
-- PRACTICE DATABASE for SQL_PRACTICE_SCENARIOS.md (PostgreSQL)
--
-- Run it (safe to re-run, it drops and recreates everything):
--   createdb practice
--   psql -d practice -f SQL_PRACTICE_SETUP.sql
--
-- Or with Docker:
--   docker run --name pg-practice -e POSTGRES_PASSWORD=pw -p 5432:5432 -d postgres:16
--   psql -h localhost -U postgres -f SQL_PRACTICE_SETUP.sql
--
-- What you get (deliberately imperfect, so there is something to debug):
--   users        1003 rows: ids 951+ never ordered, 2 duplicate emails, 1 NULL email
--   products     50 rows
--   orders       200000 rows: statuses paid/refunded/pending, every 50th has NULL user_id
--   order_items  ~400000 rows: 1 to 3 items per order
--   accounts     2 rows (for the concurrency scenarios)
--   No indexes except primary keys, on purpose.
-- =============================================================

DROP TABLE IF EXISTS order_items, orders, products, users, accounts, events CASCADE;

CREATE TABLE users (
    id         serial PRIMARY KEY,
    name       text        NOT NULL,
    email      text,
    country    text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id    serial PRIMARY KEY,
    name  text          NOT NULL,
    price numeric(10,2) NOT NULL
);

CREATE TABLE orders (
    id         serial PRIMARY KEY,
    user_id    int REFERENCES users(id),          -- NULL = guest checkout
    status     text          NOT NULL,
    total      numeric(10,2) NOT NULL,
    created_at timestamptz   NOT NULL
);

CREATE TABLE order_items (
    id         serial PRIMARY KEY,
    order_id   int           NOT NULL REFERENCES orders(id),
    product_id int           NOT NULL REFERENCES products(id),
    qty        int           NOT NULL,
    unit_price numeric(10,2) NOT NULL
);

CREATE TABLE accounts (
    id      int PRIMARY KEY,
    balance numeric NOT NULL CHECK (balance >= 0)
);

-- users: 1000 regular, then 2 duplicate emails and 1 without email
INSERT INTO users (name, email, country, created_at)
SELECT 'User ' || g,
       'user' || g || '@example.com',
       (ARRAY['SE','NO','DK','FI'])[1 + g % 4],
       now() - (g % 365) * interval '1 day'
FROM generate_series(1, 1000) g;

INSERT INTO users (name, email, country) VALUES
    ('Dup A',    'user10@example.com', 'SE'),
    ('Dup B',    'user20@example.com', 'NO'),
    ('No Email', NULL,                 'SE');

INSERT INTO products (name, price)
SELECT 'Product ' || g, (5 + g * 3)::numeric
FROM generate_series(1, 50) g;

-- orders: only users 1..950 order, every 50th order is a guest order (user_id NULL).
-- Status mix changes per user over time, so every ordering user has every status.
INSERT INTO orders (user_id, status, total, created_at)
SELECT CASE WHEN g % 50 = 0 THEN NULL ELSE 1 + (g % 950) END,
       (ARRAY['paid','paid','paid','refunded','pending'])[1 + ((g / 950) + g) % 5],
       0,
       now() - (g % 365) * interval '1 day' - (g % 86400) * interval '1 second'
FROM generate_series(1, 200000) g;

-- 1 to 3 items per order
INSERT INTO order_items (order_id, product_id, qty, unit_price)
SELECT o.id, p.id, 1 + (o.id + k.n) % 3, p.price
FROM orders o
JOIN generate_series(1, 3) AS k(n) ON k.n <= 1 + o.id % 3
JOIN products p ON p.id = 1 + (o.id * k.n) % 50;

-- order total = sum of its items
UPDATE orders o
SET total = s.t
FROM (SELECT order_id, sum(qty * unit_price) AS t
      FROM order_items
      GROUP BY order_id) s
WHERE s.order_id = o.id;

INSERT INTO accounts (id, balance) VALUES (1, 100), (2, 100);

ANALYZE;

-- Sanity check
SELECT (SELECT count(*) FROM users)       AS users,
       (SELECT count(*) FROM orders)      AS orders,
       (SELECT count(*) FROM order_items) AS order_items;
