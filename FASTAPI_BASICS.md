# FastAPI Basics

FastAPI is a Python web framework for building APIs. It is built on **Starlette** (web layer) and **Pydantic** (validation). You write normal type-hinted functions, and FastAPI gives you validation, serialization, and interactive docs for free.

## 1. Install and run

```bash
pip install "fastapi[standard]"
fastapi dev main.py            # dev server with auto-reload
# or: uvicorn main:app --reload
```

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

## 2. Minimal app

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "hello"}
```

The decorator maps an HTTP method + path to a function. The returned dict becomes JSON.

## 3. Path and query parameters

```python
@app.get("/users/{user_id}")
def get_user(user_id: int, verbose: bool = False):
    return {"id": user_id, "verbose": verbose}
```

| Part | Where it comes from |
|---|---|
| `user_id` | Path (name appears in `{}`) |
| `verbose` | Query string, optional because it has a default: `/users/5?verbose=true` |

Wrong types (`/users/abc`) return an automatic **422** error.

## 4. Request body with Pydantic

```python
from pydantic import BaseModel

class UserIn(BaseModel):
    name: str
    email: str
    age: int | None = None

@app.post("/users", status_code=201)
def create_user(user: UserIn):
    return user
```

The JSON body is parsed and validated against `UserIn`. Missing or wrong fields give a 422 with details.

## 5. Response model

```python
class UserOut(BaseModel):
    id: int
    name: str

@app.post("/users", response_model=UserOut)
def create_user(user: UserIn):
    return {"id": 1, "name": user.name, "password_hash": "secret"}
```

Only the fields in `UserOut` are returned, so `password_hash` is filtered out.

## 6. Dependency injection (`Depends`)

```python
from fastapi import Depends

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/items")
def list_items(db = Depends(get_db)):
    return db.query(Item).all()
```

Use it for DB sessions, auth, pagination params, and config. Dependencies can depend on other dependencies. Code after `yield` runs after the response (cleanup).

## 7. `async def` vs `def`

| Style | Runs on | Use with |
|---|---|---|
| `async def` | Event loop | Async libs (httpx, asyncpg) |
| `def` | Threadpool | Blocking libs (psycopg2, requests) |

Never call blocking code inside `async def`, or it stalls the whole server.

## 8. Errors

```python
from fastapi import HTTPException

@app.get("/users/{user_id}")
def get_user(user_id: int):
    if user_id not in db:
        raise HTTPException(status_code=404, detail="User not found")
    return db[user_id]
```

## 9. Routers (organizing bigger apps)

```python
# users.py
from fastapi import APIRouter

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/")
def list_users():
    return []

# main.py
app.include_router(router)
```

## 10. Other essentials

- **Auth:** `fastapi.security` (OAuth2, JWT bearer) used through `Depends`.
- **Background tasks:** `BackgroundTasks` for small post-response work. Use a real queue (Celery, etc.) for heavy jobs.
- **CORS:** `app.add_middleware(CORSMiddleware, allow_origins=[...])` when a browser frontend calls the API.
- **Lifespan:** open and close DB pools at startup and shutdown.

  ```python
  from contextlib import asynccontextmanager

  @asynccontextmanager
  async def lifespan(app: FastAPI):
      # startup
      yield
      # shutdown

  app = FastAPI(lifespan=lifespan)
  ```
- **Testing:**

  ```python
  from fastapi.testclient import TestClient

  client = TestClient(app)
  assert client.get("/").json() == {"message": "hello"}
  ```
- **Database:** no ORM included. Typical stack: SQLAlchemy (or SQLModel) + `psycopg`/`asyncpg` + Alembic migrations.
- **Production:** `uvicorn` (or `gunicorn` with uvicorn workers) behind a reverse proxy, usually in Docker.

## 11. FastAPI vs Flask

Both are Python web frameworks for HTTP APIs, and both map routes to functions with decorators. They differ in design and in what you get out of the box.

```python
# Flask
from flask import Flask, request, jsonify
app = Flask(__name__)

@app.get("/users/<int:user_id>")
def get_user(user_id):
    verbose = request.args.get("verbose", "false") == "true"
    return jsonify(id=user_id, verbose=verbose)

@app.post("/users")
def create_user():
    data = request.get_json()           # no validation, you check it yourself
    return jsonify(data), 201
```

```python
# FastAPI
from fastapi import FastAPI
from pydantic import BaseModel
app = FastAPI()

class UserIn(BaseModel):
    name: str
    email: str

@app.get("/users/{user_id}")
def get_user(user_id: int, verbose: bool = False):
    return {"id": user_id, "verbose": verbose}

@app.post("/users", status_code=201)
def create_user(user: UserIn):          # validated automatically
    return user
```

| | Flask | FastAPI |
|---|---|---|
| Style | Minimal "micro" framework | Type-hint driven API framework |
| Input handling | Manual (`request.args`, `request.get_json()`) | From function signature, validated by Pydantic |
| Validation | Add a library (marshmallow, pydantic) | Built in, automatic 422 errors |
| API docs | Add an extension (flask-restx, flasgger) | Swagger UI at `/docs` out of the box |
| Async | Supported, but the ecosystem is mostly sync | First class (`async def`), built on ASGI |
| Server | WSGI (gunicorn) | ASGI (uvicorn) |
| Dependency injection | None built in (uses `g`, extensions) | `Depends` built in |
| Templates / HTML | Jinja2 built in, good for server-rendered pages | Possible, but aimed at JSON APIs |
| Maturity | Older (2010), huge ecosystem | Newer (2018), growing fast |

**Pick FastAPI** for new JSON APIs, free validation and docs, or async I/O. **Pick Flask** for small apps, server-rendered pages, or an existing Flask codebase.

Moving between them is easy: routing and decorators carry over. The shift is that in FastAPI you declare types and the framework parses and validates, instead of you reading from `request`.

## Cheat sheet

| I want to... | Do this |
|---|---|
| Read a path value | Put `{name}` in the path + a matching function arg |
| Read a query value | Add an arg not in the path |
| Read a JSON body | Arg typed as a Pydantic model |
| Hide fields in output | `response_model=...` |
| Share logic (DB, auth) | `Depends(...)` |
| Return an error | `raise HTTPException(...)` |
| Split into files | `APIRouter` + `include_router` |

🧠 **Hook:** *Type hints are the API.* The function signature decides where each value comes from (path, query, body), how it's validated, and what shows up in the docs.
