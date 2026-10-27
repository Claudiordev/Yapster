# 09 — Kafka

`chat/pom.xml` already declares `spring-kafka` and `spring-kafka-test`, and the
root module is literally named `kafka`. There's no Kafka code yet — which makes
this the most honest section in the folder: **here's what it's for, and the
first thing it should do.**

`common-utils/dto/` still holds `OrderEvent` and `HitEvent` records from the
trading side of the project — the natural event payloads.

---

## The model, in one picture

```
PRODUCER                        BROKER                          CONSUMER GROUP
                     topic: chat-events
send(key=convId,     ┌──────────────────────────┐
     value=event)    │ partition 0  [0][1][2]…  │◄── consumer A ─┐
        │            │ partition 1  [0][1][2]…  │◄── consumer B  │ group:
        └───────────►│ partition 2  [0][1][2]…  │◄── consumer C ─┘ "chat-fanout"
       hash(key)     └──────────────────────────┘
       % partitions        append-only log,
                           retained by TIME or SIZE
                           (not "until consumed")
```

Five nouns:

| | |
|---|---|
| **Topic** | a named stream. Logical. |
| **Partition** | the unit of parallelism **and of ordering**. An append-only log. |
| **Offset** | a message's position in a partition. The consumer owns it. |
| **Consumer group** | a set of consumers sharing the work. **One partition → exactly one consumer in the group.** |
| **Broker** | a server holding partitions; one is the leader per partition. |

> **The single most important consequence:** ordering is guaranteed
> **per partition, never across a topic**. If two messages must be processed in
> order, they must share a partition — which means they must share a **key**.

```java
// Same conversationId -> same partition -> messages stay in order for that
// conversation. Different conversations spread across partitions and process
// in parallel. This one line is the whole design decision.
kafkaTemplate.send("chat-events", conversationId.toString(), event);
```

⚠️ **Partition count is effectively permanent.** You can add partitions, but
that changes `hash(key) % n` and existing keys move — so ordering breaks across
the boundary. Size it up front (a common rule: target throughput ÷ per-consumer
throughput, then round up generously). You can never reduce it.

---

## Why Kafka for `chat` — the concrete use case

The problem from `06-full-stack-cluster/stack/06-chat.yaml`: with 2+ replicas,
Alice's socket is on pod-A and Bob's on pod-B, and `ChatWebSocketHandler`'s
in-memory map means pod-A can't reach Bob.

```java
// application/port/socket/EventGateway.java — the port already exists.
public interface EventGateway {
    void publish(ChatEvent event);
}
```

```java
// infrastructure/adapter/socket/KafkaEventGateway.java — the new adapter.
@Component
@Primary
@RequiredArgsConstructor
public class KafkaEventGateway implements EventGateway {

    private final KafkaTemplate<String, ChatEvent> kafka;
    private final LocalSocketRegistry localSockets;   // this pod's sockets

    @Override
    public void publish(ChatEvent event) {
        // Key by conversation: ordering per conversation, parallelism across them.
        kafka.send("chat-events", event.conversationId().toString(), event);
    }

    // EVERY pod consumes EVERY event and delivers to whichever sockets it
    // happens to own locally.
    //
    // ⚠️ Note groupId: each POD needs its own group, so all pods receive all
    // events (broadcast). With a shared group, Kafka would give each event to
    // exactly ONE pod — and that pod probably doesn't hold the recipient's
    // socket. This is the detail people get wrong: consumer groups are for
    // WORK SHARING, and fan-out to every instance is the opposite of that.
    @KafkaListener(topics = "chat-events",
                   groupId = "chat-fanout-#{T(java.util.UUID).randomUUID()}")
    public void onEvent(ChatEvent event) {
        localSockets.deliverTo(event.recipients(), event);   // no-op if absent
    }
}
```

`ChatService` doesn't change. That's the hexagonal payoff, stated concretely.

**Be ready for the pushback:** *"Isn't Redis pub/sub enough here?"* Yes —
and it's the better first choice: you already run Redis, it's one dependency
fewer, and fan-out is exactly what pub/sub is for. Kafka earns its place when
you need **durability and replay** — a client that reconnects after 30 seconds
and wants the messages it missed. Redis pub/sub is fire-and-forget; a
disconnected subscriber loses them permanently. Say which trade-off you're
making rather than reaching for Kafka reflexively.

---

## Delivery semantics

| | Means | How |
|---|---|---|
| **At most once** | may lose, never duplicates | commit the offset *before* processing |
| **At least once** | never loses, may duplicate | commit *after* processing ← **the default, and what you want** |
| **Exactly once** | neither | idempotent producer + transactions, Kafka-to-Kafka only |

> **The answer that matters: at-least-once plus an idempotent consumer.**
> True end-to-end exactly-once doesn't exist once you write to Postgres or call
> Twilio — Kafka's transactions cover Kafka. So consumers must tolerate seeing
> a message twice.

```java
// Idempotent consumer: dedupe on a business key.
@KafkaListener(topics = "order-events")
@Transactional
public void onOrder(OrderEvent event) {
    // A unique constraint on order_id makes the second delivery a no-op
    // instead of a duplicate row. Simple, and it survives restarts —
    // an in-memory "seen" set does not.
    if (processed.existsByOrderId(event.orderId())) return;
    orders.apply(event);
    processed.record(event.orderId());
}
```

---

## Producer settings that decide whether you lose data

```properties
spring.kafka.producer.acks=all
# 0    = fire and forget. Fast, loses data on any broker hiccup.
# 1    = the LEADER acked. Loses data if the leader dies before replicating.
# all  = all in-sync replicas acked.  ← the only correct setting for events
#        you can't recreate.

spring.kafka.producer.properties.enable.idempotence=true
# Producer retries can DUPLICATE a message (the ack was lost, not the write).
# Idempotence adds a sequence number so the broker discards the retry.
# Default true in modern clients — say it anyway, it's a good detail.

spring.kafka.producer.properties.max.in.flight.requests.per.connection=5
# >1 with retries can REORDER... unless idempotence is on, which caps it at 5
# and preserves order. The two settings interact.

spring.kafka.producer.retries=2147483647
spring.kafka.producer.properties.delivery.timeout.ms=120000
# Bound the total, not the attempt count.
```

⚠️ **`acks=all` alone is not enough.** It means "all *in-sync* replicas" — and
if replicas have fallen behind, the ISR can shrink to just the leader, so
`acks=all` degrades to `acks=1` silently. Pair it with a broker/topic setting:

```
min.insync.replicas=2      (with replication.factor=3)
```

Now a write fails loudly rather than being accepted with one copy.

---

## Consumer settings and the rebalance trap

```properties
spring.kafka.consumer.group-id=chat-processor
spring.kafka.consumer.auto-offset-reset=earliest
# earliest = a NEW group reads the whole retained log
# latest   = only new messages
# ⚠️ Only applies when there's no committed offset. It is not a replay switch.

spring.kafka.consumer.enable-auto-commit=false
spring.kafka.listener.ack-mode=RECORD
# Auto-commit commits on a TIMER, so it can commit a message you haven't
# finished processing -> at-most-once by accident. Turn it off.
```

```java
// The rebalance trap, which is the best Kafka war story to have ready:
//
//   max.poll.interval.ms (default 5 min) is the deadline between poll() calls.
//   Your listener takes 6 minutes on a batch -> the broker decides the consumer
//   is dead -> REBALANCE -> the partition is reassigned to another consumer ->
//   that one reprocesses the same records -> also takes 6 minutes -> rebalances
//   again. The group never makes progress and it looks like an infinite loop.
//
// Fixes: lower max.poll.records, raise max.poll.interval.ms, or move slow work
// off the listener thread.
```

```properties
spring.kafka.consumer.max-poll-records=100
spring.kafka.consumer.properties.max.poll.interval.ms=300000
spring.kafka.listener.concurrency=3
# concurrency <= partition count. Setting 10 on a 3-partition topic leaves
# 7 consumers permanently idle — a partition goes to exactly one consumer.
```

**Consumer lag is the metric that matters.** It's the gap between the latest
offset and the committed one — i.e. how far behind you are. Growing lag means
consumers can't keep up: add partitions *and* consumers, or make processing
faster. Alert on it.

---

## Error handling in Spring Kafka

```java
@Bean
DefaultErrorHandler errorHandler(KafkaTemplate<String, Object> template) {
    // Dead-letter: after retries, publish to chat-events.DLT and MOVE ON.
    var recoverer = new DeadLetterPublishingRecoverer(template);
    // 3 attempts, 1s apart. WITHOUT a limit, a poison message blocks the
    // partition FOREVER — nothing behind it is ever processed. That's the
    // failure mode to name.
    return new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 3L));
}
```

```java
@KafkaListener(topics = "chat-events.DLT")
public void onDead(ChatEvent e, @Header(KafkaHeaders.DLT_EXCEPTION_MESSAGE) String why) {
    log.error("dead-lettered: {} because {}", e, why);   // alert on this topic
}
```

---

## The dual-write problem → the Outbox pattern

The question that separates people who've run Kafka in production from people
who've read about it.

```java
// ❌ BROKEN. Two systems, no shared transaction.
@Transactional
public void send(Message m) {
    messages.save(m);                     // Postgres commits...
    kafka.send("chat-events", event);     // ...and this throws.
}   // The DB has the message. Kafka doesn't. They are now permanently
    // inconsistent, and no amount of retrying fixes it — @Transactional does
    // not roll back a Kafka send. Reverse the order and you get the opposite
    // bug: an event for a message that was never saved.
```

```java
// ✅ OUTBOX. Write both in ONE database transaction.
@Transactional
public void send(Message m) {
    messages.save(m);
    outbox.save(new OutboxEvent("chat-events", m.conversationId(), toJson(m)));
}   // One commit. Either both rows exist or neither does.

// A separate relay publishes and marks rows sent — or Debezium tails the
// Postgres WAL and publishes the outbox table straight to Kafka (CDC), which
// needs no polling at all.
```

This gives **at-least-once** (the relay can crash after publishing, before
marking) — which is exactly why consumers must be idempotent. It all connects.

---

## Serialization

```properties
spring.kafka.producer.value-serializer=org.springframework.kafka.support.serializer.JsonSerializer
spring.kafka.consumer.value-deserializer=org.springframework.kafka.support.serializer.ErrorHandlingDeserializer
spring.kafka.consumer.properties.spring.deserializer.value.delegate.class=org.springframework.kafka.support.serializer.JsonDeserializer
spring.kafka.consumer.properties.spring.json.trusted.packages=com.claudiordese.dto
```

- **`ErrorHandlingDeserializer` is not optional.** A message that can't
  deserialise throws *before* your listener runs, so the error handler never
  sees it — the consumer just crash-loops on the same offset forever. This
  wrapper turns it into a failed record the DLT can catch.
- **`trusted.packages`** — `JsonDeserializer` instantiates types named in the
  headers. Leaving it `*` is a deserialization-gadget risk.
- **JSON vs Avro:** JSON is readable and needs no infrastructure, but nothing
  stops a producer breaking every consumer. **Avro + Schema Registry** enforces
  compatibility at publish time and is much smaller on the wire. The rule
  either way: **only ever make backward-compatible changes** — add optional
  fields, never rename or remove. Same discipline as a Flyway migration during
  a rolling deploy.

---

## Retention vs compaction

```
cleanup.policy=delete   (default)  keep 7 days / N GB, then drop. EVENTS.
cleanup.policy=compact             keep the LATEST value per key, forever. STATE.
```

Compaction is how a topic becomes a replayable snapshot: a new consumer reads
from the beginning and reconstructs current state. A `null` value is a
**tombstone** — it deletes the key.

⚠️ Kafka retains by time/size, **not until consumed**. A consumer down longer
than the retention window loses messages permanently, and comes back with an
offset that no longer exists (`auto.offset.reset` then decides what happens).

---

## Kafka vs RabbitMQ vs SQS

| | Kafka | RabbitMQ | SQS |
|---|---|---|---|
| Model | **log** — consumers track offsets | **queue** — broker deletes on ack | queue, managed |
| Replay | ✅ rewind the offset | ❌ gone once acked | ❌ |
| Multi-consumer | ✅ N groups read the same data | needs an exchange fan-out | ❌ (SNS in front) |
| Ordering | per partition | per queue | FIFO queues only |
| Throughput | very high | moderate | high |
| Routing | dumb broker, smart consumer | rich routing rules | none |
| Ops | heavy (or MSK) | moderate | zero |

**One line:** *"Kafka is a durable, replayable log you can attach many
independent consumers to. RabbitMQ is a smart router that forgets. If you need
replay or multiple independent readers of the same stream, that's Kafka."*

For this project, the honest sizing: chat fan-out alone doesn't justify running
Kafka. A trading pipeline emitting `OrderEvent`/`HitEvent` that risk, audit, and
analytics each consume independently — that does.

---

## Testing

```java
@SpringBootTest
@Testcontainers
class ChatEventIT {
    @Container
    static KafkaContainer kafka = new KafkaContainer(
            DockerImageName.parse("confluentinc/cp-kafka:7.6.0"));

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);
    }
}
// `spring-kafka-test` (already in chat/pom.xml) also gives you @EmbeddedKafka,
// which is faster but is a JVM-embedded broker — it drifts from real broker
// behaviour. Testcontainers runs the real thing; prefer it, same argument as
// Postgres over H2.
```

---

## On Kubernetes / AWS

- **Don't self-host Kafka on Kubernetes for a small team.** It's stateful,
  rebalance-sensitive, and disk-bound. Use the **Strimzi** operator if you must
  — never hand-written StatefulSets. On AWS, use **MSK** (see `10-aws.md`).
- Kafka needs **stable network identity** → StatefulSet + headless Service,
  exactly like the Postgres pattern in `06-full-stack-cluster/stack/02-databases.yaml`.
- **Consumer lag is your autoscaling signal**, not CPU. HPA on CPU won't react
  to a backlog; **KEDA** scales on lag directly.
- ⚠️ Scaling consumer pods past the partition count does nothing — the extra
  pods sit idle. Partition count is the real concurrency ceiling.

---

## 🧠 Hooks

- **Ordering is per partition. Same key → same partition.**
- **A partition goes to exactly one consumer in a group** — that's the concurrency ceiling.
- **Consumer groups share work; fan-out to every instance needs a group *per instance*.**
- **At-least-once + idempotent consumers.** End-to-end exactly-once is a myth once you leave Kafka.
- **`acks=all` is only as good as `min.insync.replicas`.**
- **A poison message with no DLT blocks the partition forever.**
- **Slow listener → `max.poll.interval.ms` → endless rebalance loop.**
- **Never dual-write to the DB and Kafka.** Outbox, in one transaction.
- **Kafka retains by time, not until consumed.**
- **`ErrorHandlingDeserializer`, or a bad message crash-loops forever.**
