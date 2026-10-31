# Async, Threads and SQL in Python

Python has three concurrency models. Which one to pick depends on whether the work is waiting (I/O) or computing (CPU). SQL queries are almost always waiting.

## 1. The three models

| Model | Best for | How it runs |
|---|---|---|
| **Threads** | Blocking I/O with sync libraries (psycopg2, requests) | OS threads. The GIL lets only one run Python code at a time, but it is released while waiting on I/O. |
| **asyncio** | Lots of concurrent I/O with async libraries (asyncpg, httpx) | One thread, one event loop. Tasks hand control back at `await`. |
| **multiprocessing** | CPU-heavy work (parsing, number crunching) | Separate processes, each with its own GIL. |

A DB query spends its time waiting on the network and the server, so threads and asyncio both help. Neither speeds up CPU-bound Python code.

## 2. Threads

```python
from concurrent.futures import ThreadPoolExecutor

def fetch_user(user_id):
    ...  # blocking call

with ThreadPoolExecutor(max_workers=10) as pool:
    results = list(pool.map(fetch_user, [1, 2, 3, 4]))
```

Use `ThreadPoolExecutor` rather than raw `threading.Thread`. It handles start, join, results, and exceptions.

## 3. asyncio

```python
import asyncio

async def fetch_user(user_id):
    await asyncio.sleep(1)          # stand-in for an async DB call
    return user_id

async def main():
    results = await asyncio.gather(*(fetch_user(i) for i in range(10)))
    # ten 1-second calls finish in ~1 second total

asyncio.run(main())
```

- `async def` defines a coroutine, and `await` is where it can pause.
- `gather` runs coroutines concurrently. `asyncio.TaskGroup` (3.11+) is the safer version, since it cancels siblings on error.
- **Never call blocking code inside `async def`.** `time.sleep`, `requests.get`, or a psycopg2 query freezes the whole event loop. Use `await asyncio.to_thread(blocking_fn, arg)` when you have no choice.

## 4. SQL with threads (sync)

**Rule: never share one connection or session between threads.** Each thread gets its own, usually from a pool.

```python
from sqlalchemy import create_engine, text
from concurrent.futures import ThreadPoolExecutor

engine = create_engine(
    "postgresql+psycopg://user:pw@localhost/mydb",
    pool_size=10, max_overflow=5,
)

def count_orders(user_id):
    with engine.connect() as conn:          # borrows a connection from the pool
        return conn.execute(
            text("SELECT count(*) FROM orders WHERE user_id = :u"),
            {"u": user_id},
        ).scalar()

with ThreadPoolExecutor(max_workers=8) as pool:
    print(list(pool.map(count_orders, range(1, 100))))
```

- The **engine** is thread-safe and shared. **Connections** and **Sessions** are not.
- Keep `max_workers` at or below the pool size, or threads queue waiting for a connection.
- With plain psycopg2, use `psycopg2.pool.ThreadedConnectionPool`.

## 5. SQL with asyncio

Use an async driver: `asyncpg`, or `psycopg` 3 in async mode. SQLAlchemy wraps them.

```python
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(
    "postgresql+asyncpg://user:pw@localhost/mydb", pool_size=10
)
Session = async_sessionmaker(engine, expire_on_commit=False)

async def count_orders(user_id):
    async with Session() as session:
        result = await session.execute(
            text("SELECT count(*) FROM orders WHERE user_id = :u"), {"u": user_id}
        )
        return result.scalar()

async def main():
    print(await asyncio.gather(*(count_orders(i) for i in range(1, 100))))

asyncio.run(main())
```

Notes for async SQLAlchemy:

- Everything that touches the DB must be awaited. Lazy loading of relationships fails in async, so use `selectinload()` / `joinedload()` in the query.
- `expire_on_commit=False` avoids implicit reloads after commit, which would try to run SQL outside an await.
- One `AsyncSession` per task, never shared across concurrent tasks.

## 6. FastAPI

```python
from fastapi import Depends

async def get_session():
    async with Session() as session:
        yield session

@app.get("/users/{user_id}")
async def get_user(user_id: int, session = Depends(get_session)):
    result = await session.execute(text("SELECT * FROM users WHERE id = :i"), {"i": user_id})
    return result.mappings().first()
```

- `async def` endpoint: use the **async** driver.
- plain `def` endpoint: use the **sync** driver. FastAPI runs it in a threadpool for you.
- Don't mix them: a sync DB call inside `async def` blocks every other request.

## 7. SQL-side concerns when running concurrently

**Connection limits.** Postgres has a `max_connections` limit (default 100). Total connections is workers x `pool_size`, so many app instances can exhaust it. Use **PgBouncer** for large setups.

**Concurrent writes and race conditions.** Two workers doing read, then write can overwrite each other. Fixes:

```sql
-- Atomic update instead of read-modify-write
UPDATE accounts SET balance = balance - 50 WHERE id = 1;

-- Lock the row while you work on it
BEGIN;
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
-- ... compute ...
UPDATE accounts SET balance = 100 WHERE id = 1;
COMMIT;

-- Job queue: each worker grabs different rows without blocking
SELECT * FROM jobs
WHERE status = 'pending'
ORDER BY id
LIMIT 1
FOR UPDATE SKIP LOCKED;

-- Insert-or-ignore safely
INSERT INTO users (email) VALUES ('a@b.com') ON CONFLICT (email) DO NOTHING;
```

**Deadlocks.** Two transactions lock the same rows in opposite order. Lock in a consistent order and keep transactions short.

**Transactions are per connection.** Work split across several threads or tasks is not in one transaction, unless they share a connection, which you shouldn't do.

**Concurrent queries on one connection don't work.** A single DB connection runs one query at a time. For real parallel queries you need multiple connections, which `gather` plus a pool gives you.

## 8. Which to pick

| Situation | Choose |
|---|---|
| Simple script, a few parallel queries | `ThreadPoolExecutor` + sync driver |
| Web API with many concurrent requests | FastAPI + async driver, or sync `def` endpoints |
| Thousands of concurrent connections or sockets | asyncio |
| Heavy CPU work on the results | `ProcessPoolExecutor` / multiprocessing |
| Bulk loading data | One connection with `COPY` or `executemany`, not threads |
| Mixed: async app calling a sync library | `await asyncio.to_thread(...)` |

Often the biggest speedup isn't concurrency at all. One query with a good join and index beats 100 parallel small queries, so avoid the N+1 pattern first.

🧠 **Hook:** *One connection, one query at a time. Concurrency means more connections (a pool), never sharing one. Async means no blocking calls on the event loop.*
