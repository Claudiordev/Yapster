The full picture (Alice sends "hey" to a group of Alice, Bob, Carol)

┌─────────────────────────────────────────────────────────────────────┐
│  ChatService.sendMessage(conv, alice, "hey")     ← APPLICATION LAYER  │
│                                                                       │
│  1) isMember(conv, alice)? ✔                                          │
│  2) messages.saveMessage(...)  ──► Postgres  (assigns seq = 42)       │
│  3) evt = MessageEvent(conv, alice, "hey", sentAt)   ← ONE object     │
│  4) members = conversations.membersOf(conv) = [alice, bob, carol]     │
│                                                                       │
│  5)  for (member : members)          ◄── FAN-OUT #1 (loop over people)│
│          gateway.send(member, evt)                                     │
└───────────────┬───────────────────────┬────────────────┬────────────┘
send("alice",evt)        send("bob",evt)     send("carol",evt)
│                        │                  │
▼                        ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  WebSocketEventGateway.send(userId, evt)         ← INFRASTRUCTURE     │
│                                                                       │
│  sessions  (ConcurrentHashMap<userId, Set<Session>>):                 │
│     "alice" → { sockA1(laptop), sockA2(phone) }                       │
│     "bob"   → { sockB1(laptop) }                                      │
│      (no "carol" key)                                                 │
│                                                                       │
│  send("alice"): set = get("alice") → 2 sockets                        │
│        for (s : set) s.sendMessage(json)   ◄── FAN-OUT #2 (devices)   │
│            └─► sockA1 ✅   └─► sockA2 ✅   (echo to her own tabs)      │
│                                                                       │
│  send("bob"):   set = get("bob")   → 1 socket                         │
│            └─► sockB1 ✅                                              │
│                                                                       │
│  send("carol"): set = get("carol") → null → return;  ⭕ (offline)     │
│            (nothing sent, she'll get it via unread count + history)  │
└─────────────────────────────────────────────────────────────────────┘
│            │            │
▼            ▼            ▼
Alice's laptop  Alice's phone  Bob's laptop   ← browsers receive JSON

## Conversations read are saved by conversation_member lastReadSeq