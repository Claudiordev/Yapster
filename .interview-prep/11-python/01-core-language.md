# 01 — Python Core Language

## Names point to objects

```python
items = [1, 2]
alias = items          # same list
copy = items.copy()    # new outer list
alias.append(3)
```

Assignment binds a name to an object. A function call passes object references by assignment: rebinding a parameter does not rebind the caller's name, but mutating a shared mutable object is visible to the caller. This is often called *call by sharing*.

Use `is` for identity checks and singleton values such as `None`; use `==` for value equality. User-defined equality affects hashability: if equal objects can have different hashes, dictionaries and sets cannot behave correctly. Mutable objects should generally not be hash keys.

## Mutable defaults and closures

```python
def add_tag(tag, tags=None):
    if tags is None:
        tags = []
    tags.append(tag)
    return tags
```

The default object is created once when the function is defined. The same rule explains callback bugs where a closure observes a later loop value. Bind the intended value in a helper or a default parameter, or use `functools.partial`.

Scope follows LEGB: Local, Enclosing, Global, Built-in. `nonlocal` rebinds an enclosing function's local; `global` rebinds a module-level name. Prefer explicit state passed through arguments over either.

## Iteration protocol

An iterable supplies an iterator (`iter(value)`). An iterator returns itself from `__iter__` and advances with `__next__`, raising `StopIteration` when exhausted. A generator is a compact way to implement this protocol:

```python
def rows(source):
    for row in source:
        if row.is_valid:
            yield row
```

Generator expressions and `itertools` enable lazy pipelines. Laziness saves memory but delays work and exceptions; a generator is normally exhausted after one pass. Materialize only when you need repeated traversal, random access, or a stable snapshot.

## Exceptions and context managers

Catch only errors for which the current layer has a recovery or translation policy. Use `raise ... from exc` to preserve the cause while adding domain context. Avoid using exceptions for routine high-volume control flow.

A context manager implements `__enter__`/`__exit__` or is created with `contextlib`. It makes cleanup run on both success and failure. The `with` block is also useful for transactions and locks; be explicit about whether failure should commit, roll back, or be suppressed.

## Object model

Python special methods are looked up through the type, not as ordinary attributes on an instance. Use established protocols (`__iter__`, `__len__`, `__enter__`) rather than inventing ad hoc conventions. Properties and descriptors control attribute access; metaclasses are powerful but rarely the simplest extension point.

Use `dataclasses` for data-carrying types, `Enum` for finite symbolic values, and composition when behavior varies independently. Inheritance should model a stable substitutable relationship. Be wary of broad base classes that force subclasses to inherit irrelevant behavior.

## Common traps to explain

- `list_a = list_b` is aliasing; `list_b[:]` is only a shallow copy.
- A tuple is immutable as a container, but its members may be mutable.
- `bool` is a subclass of `int`; avoid relying on this in domain validation.
- `and` / `or` return operands, not necessarily `True` / `False`.
- `for ... else` runs `else` only when the loop did not `break`.
- `finally` always runs during normal unwinding; a `return` or exception from `finally` can mask an earlier result or error.
- List/dict/set comprehensions have their own scope in modern Python; a normal `for` loop still assigns its target in the surrounding scope.

