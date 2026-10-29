# Python vs Java — Quick Comparison Sheet

Use this when translating familiar Java ideas into Python. The equivalents are useful starting points, but they are not always identical.

## Syntax and typing

| Idea | Java | Python |
|---|---|---|
| Variable | String name = "Ada"; | name = "Ada" |
| Optional type description | Types are declared in normal variables | name: str = "Ada" is a type hint; Python does not enforce it at runtime |
| Block | Braces { ... } | Indentation defines the block |
| Statement end | Usually ; | Newline; semicolons are rarely used |
| Else-if | else if | elif |
| Null value | null | None |
| String interpolation | "Hi, " + name / String.format | f"Hi, {name}" |
| Boolean operators | &&, ||, ! | and, or, not |
| Equality | .equals() for object value equality | == for value equality; is for identity, commonly x is None |

```python
name = "Ada"
age = 37

if age >= 18:
    print(f"{name} is an adult")
else:
    print(f"{name} is under 18")
```

Python variables are names bound to objects; the same name can later refer to a value of another type. Type hints help editors and static checkers, but they do not make Python behave like Java's compile-time type system.

## Collections and data structures

| Python | Closest Java idea | Key difference |
|---|---|---|
| list[T] | ArrayList<T> / List<T> | Python lists can contain mixed types; type hints do not enforce contents at runtime |
| tuple[T, ...] | No exact built-in equivalent | Fixed-length, ordered sequence; the tuple itself cannot be changed after creation |
| dict[K, V] | HashMap<K, V> / Map<K, V> | Key/value mapping; Python dictionaries preserve insertion order |
| set[T] | HashSet<T> / Set<T> | Unique values; order is not the point |
| str | String | Immutable text |

### Tuple compared with Java

**A tuple is an ordered group of values that you don't plan to rearrange or replace. Think of it as a small fixed bundle.**

The tuple's positions cannot be reassigned, but an object stored inside it can still be mutable:

```python
item = ("tags", ["python"])
item[1].append("sql")  # Allowed: the inner list changed
print(item)             # ("tags", ["python", "sql"])

item[1] = ["java"]      # TypeError: cannot replace a tuple item
```

Tuples are often used for a small fixed group of values, unpacking, or as a dictionary key when all their elements are hashable.

```python
point = (3, 7)
x, y = point                 # unpack the two values
one_value_tuple = (3,)       # comma makes it a tuple
```

Python has **no exact general-purpose built-in equivalent** to a tuple. Choose the Java representation based on what the values mean:

- For named, fixed fields such as coordinates, use a Java record: record Point(int x, int y) {}. This is usually clearer because callers use point.x() and point.y() instead of positions.
- For an ordered collection, Java List.of(...) creates an unmodifiable list, but it is not a tuple: a Java list has one element type, while a Python tuple can hold different types, and List.of rejects null elements.
- For a two-value pair, a record or Map.Entry<K, V> may fit, depending on the meaning.

Both a Python tuple and a Java record are only **shallowly immutable**: if a contained field refers to a mutable object, that object may still change. A Python tuple can be a dictionary key only if every element is hashable.

```python
user = {"name": "Ada", "active": True}  # dict: named values
colors = {"red", "blue", "red"}        # set: duplicates collapse
```

## Loops and comprehensions

Java:

```java
for (Task task : tasks) {
    System.out.println(task.title());
}
```

Python:

```python
for task in tasks:
    print(task.title)
```

Python's for iterates over values from an iterable. Use enumerate(items) when you need both an index and an item. A list comprehension is a concise way to build a list:

```python
open_titles = [task.title for task in tasks if not task.done]
```

Use a normal loop when the logic has multiple steps or side effects. See the [Python control flow](https://docs.python.org/3/tutorial/controlflow.html) and [data structures](https://docs.python.org/3/tutorial/datastructures.html) tutorials.

## Functions and methods

Java methods are declared inside a class and normally declare parameter and return types. Python functions can be defined at module level or inside a class; type hints are optional.

```python
def add(a: int, b: int = 0) -> int:
    return a + b

total = add(4, 5)
also_total = add(a=4, b=5)  # keyword arguments
```

- If a Python function has no return, it returns None (similar to a void method's lack of a useful result).
- Python supports default and keyword arguments instead of relying on Java-style method overloads for many APIs.
- Functions are values: they can be passed to another function or stored in a variable.
- An instance method declares self explicitly. Java supplies this implicitly.
- Avoid mutable default arguments such as def add(item, items=[]): that list would be reused across calls.

```python
from dataclasses import dataclass

@dataclass
class Task:
    id: int
    title: str
    done: bool = False
```

dataclass is often the concise option for a Python class that mainly carries data. A Java record is a reasonable comparison, but Python dataclasses and Java records have different language and type-system behavior.

## The program entry point

Java applications commonly start at public static void main(String[] args). A Python script usually defines main() and calls it only when that file is run directly:

```python
def main() -> None:
    print("Hello from Python")


if __name__ == "__main__":
    main()
```

When Python runs this file directly, __name__ is "__main__". When another module imports it, the guarded code does not run. This keeps imports reusable and makes scripts easier to test. See the official [Python __main__ documentation](https://docs.python.org/3/library/__main__.html).

For a FastAPI web API, the server imports an app = FastAPI() object as the application entry point; you normally do not start the web server by writing your own main() loop.

## Exceptions and resource cleanup

| Idea | Java | Python |
|---|---|---|
| Handle an error | try / catch | try / except |
| Checked exceptions | Language supports them | No checked-exception declarations |
| Close a file/resource | try-with-resources | with open(...) as file: |

Use with for resources that must be released even when an error occurs. In Python, catch the specific exceptions you can handle rather than catching everything and hiding the failure.

## Threads and concurrency

| Need | Java | Python |
|---|---|---|
| Start a thread directly | Thread / Runnable | threading.Thread |
| Submit work to a pool | ExecutorService | concurrent.futures.ThreadPoolExecutor |
| Coordinate shared state | synchronized, locks, concurrent collections | threading.Lock, queues, and other threading primitives |
| Many cooperative I/O tasks | Reactive APIs / virtual threads / executors | asyncio with async-compatible libraries |
| CPU-heavy parallel work | Thread pools commonly use multiple cores | ProcessPoolExecutor is a common choice in regular CPython |

In the standard GIL-enabled CPython build, threads are useful for I/O-bound work because they can make progress while another thread waits. They generally do not run Python bytecode in parallel across CPU cores. Free-threaded CPython builds exist as an optional configuration starting with Python 3.13, but do not assume that is the default runtime or that every dependency supports it. See the official [threading](https://docs.python.org/3/library/threading.html) and [free-threading](https://docs.python.org/3/howto/free-threading-python.html) guides.

For a first CRUD API, do not manually create a thread per request. Start with normal request handlers and one database session/connection per request. Use async def when the I/O libraries you call are also async; putting blocking database or network calls inside an async handler blocks the event loop.

## A small Python project and the Java analogy

| Concern | Java ecosystem | Python option |
|---|---|---|
| Build/dependency setup | Maven / Gradle | pyproject.toml plus a virtual environment and pip or uv |
| Source organization | packages and classes | .py modules grouped into importable packages |
| HTTP CRUD API | Spring Boot | FastAPI |
| Request/response validation | Bean Validation / DTOs | Pydantic models; SQLModel can combine these patterns with database models |
| SQL access | JDBC / JPA | Start with built-in sqlite3; then SQLModel or SQLAlchemy |
| PostgreSQL driver | JDBC driver | Psycopg 3 for direct SQL, or SQLAlchemy with a PostgreSQL driver |
| Schema migrations | Flyway / Liquibase | Alembic with SQLAlchemy |
| Tests | JUnit | pytest (often with FastAPI's TestClient) |

For a learning project, start with a single main.py and SQLite so the SQL is visible. Split it as it grows:

```text
task_api/
  app/
    main.py       # create the API and register routes
    models.py     # request/response and database models
    database.py   # engine/session configuration
    tasks.py      # task CRUD operations
  tests/
  pyproject.toml
```

Build it in steps: first make an in-memory task script; add SQLite and parameterized SQL; expose CRUD routes with FastAPI; then move to PostgreSQL and add migrations. FastAPI's official [SQL database tutorial](https://fastapi.tiangolo.com/tutorial/sql-databases/) uses SQLModel for SQLite and notes that SQLModel is built on SQLAlchemy and Pydantic.

## Official references

- [Python tutorial: control flow](https://docs.python.org/3/tutorial/controlflow.html)
- [Python tutorial: data structures and tuples](https://docs.python.org/3/tutorial/datastructures.html)
- [Python __main__ entry point](https://docs.python.org/3/library/__main__.html)
- [Python threading and the GIL](https://docs.python.org/3/library/threading.html)
- [Python free-threading support](https://docs.python.org/3/howto/free-threading-python.html)
- [Java Record](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Record.html)
- [Java List.of](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/List.html)
- [FastAPI SQL database tutorial](https://fastapi.tiangolo.com/tutorial/sql-databases/)

