# Chat sockets across replicas (Redis)

## Problem

`WebSocketEventGateway` kept every `WebSocketSession` in a `ConcurrentHashMap` inside the JVM. With a
second replica of `chat` that breaks in three ways:

1. `send(userId, event)` only reaches the sockets of the replica that handled the request. Alice on
   replica A sends a message, Bob is connected to replica B and never receives it.
2. `isOnline`, `onlineUsers`, `onlineDevices` only describe one replica, so presence is wrong (a user
   with a tab on each replica is reported OFFLINE when one tab closes) and `/monitor` under-reports.
3. User status (`BUSY`, `IDLE`) lived in a local map, so it differs per replica.

## Design

A `WebSocketSession` cannot be serialised, so it is not moved. Each replica keeps its own sessions
and the replicas share two things through Redis:

| Concern | Mechanism |
|---|---|
| Who is connected / status | `SocketRegistry` interface, `RedisSocketRegistry` adapter |
| Delivering to sockets on another replica | `ClusterEventPublisher` + `RedisClusterEventSubscriber` over pub/sub |

`EventGateway` (the application port) is unchanged, so `ChatService` and `CallPresenceService` do not
know about replicas.

### Redis keys (`chat.sockets.key-prefix`, default `chat:ws`)

| Key | Type | Content |
|---|---|---|
| `chat:ws:user:<userId>` | sorted set | member `<nodeId>:<sessionId>`, score = expiry (epoch ms) |
| `chat:ws:conns` | sorted set | member `<userId>\|<nodeId>:<sessionId>`, score = expiry |
| `chat:ws:status` | hash | `userId` to `UserStatusType` |
| `chat:ws:events` | pub/sub channel | JSON `ClusterEnvelope(origin, userId, payload)` |

The score is a lease. Each replica refreshes the leases of its own sockets every
`heartbeat-interval` (10s). A replica that crashes stops refreshing, so its sockets drop out of every
count after `connection-ttl` (30s) and nobody is stuck "online". Counting always filters on
`score > now`, so correctness does not depend on the cleanup running. A graceful shutdown removes the
replica's connections immediately.

### Flows

- **connect / disconnect**: local map + `registry.add/remove`. The OFFLINE broadcast only fires when
  the user has no socket on any replica (`isOnline` is cluster wide).
- **send(userId, event)**:
  1. `local` = sockets in this JVM, `remote` = registry count minus `local`.
  2. Both zero: user is offline, return.
  3. Serialise once; write to local sockets; if `remote > 0` publish the same frame.
  4. Every replica receives the publication, ignores its own (`origin`), and writes to its local
     sockets of that user (no-op if it has none).
  With one replica `remote` is always 0, so nothing is ever published.
- **status**: stored in the shared hash, removed when the last socket closes. `setStatus` still returns
  whether the status changed, which `ChatService.sendUserStatus` uses to suppress duplicates.

### Failure behaviour

Redis being down must not take chat down for users connected to the same replica:

- registry failures are logged and the gateway falls back to its local view (`isOnline`, counts);
- a failed publish is logged, local delivery has already happened;
- the heartbeat re-publishes every local socket, so state heals when Redis returns (also after a flush).

Cross-replica delivery is best effort (Redis pub/sub is at-most-once). Messages are persisted before
being pushed, so a missed push is recovered by history/unread counts, as for an offline user today.

## Configuration

```
chat.sockets.node-id=                 # blank = random per process
chat.sockets.connection-ttl=30s
chat.sockets.heartbeat-interval=10s   # keep well below the ttl
chat.sockets.key-prefix=chat:ws
```

Redis connection uses the existing `spring.data.redis.*` settings (already used for rate limiting and
call presence). Replicas must share the same Redis and the same `key-prefix`.

## Cost / trade-offs

- One extra Redis round trip per `send` (the registry count) so that events are only published when
  another replica really holds a socket.
- `onlineUsers()` reads the `conns` sorted set to count distinct users. It is O(connections) and only
  used by the monitor endpoint.
- No sticky sessions are needed for `/ws`: any replica can deliver to any user.

## Implementation steps (done)

1. `SocketRegistry`, `RedisSocketRegistry`.
2. `ClusterEnvelope`, `ClusterEventPublisher`, `RedisClusterEventPublisher`, `RedisClusterEventSubscriber`,
   `SocketClusterConfig` (listener container), `SocketClusterProperties`.
3. `WebSocketEventGateway` uses the registry and the publisher, heartbeat + graceful shutdown.
4. Unit tests (`WebSocketEventGatewayTest`: two gateways, in-memory registry and bus) and a
   Testcontainers integration test (`RedisSocketClusterIT`, real Redis, skipped without Docker).
5. Docs: this file, `architecture.md`.
