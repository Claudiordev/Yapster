# Media Capacity — One Base Machine

Concurrent-user estimates for audio, video, and streaming on a single host.
Calculations only, not benchmarked.

**Base machine:** Intel Xeon D-2123IT (4c/8t), 32 GB ECC, **500 Mbps**
→ **~400 Mbps usable** (20 % kept as headroom).

**How it works:** the LiveKit SFU forwards each stream to the others in a room — no
mixing or transcoding, so **bandwidth is the limit** (CPU/RAM have room to spare).

```
max users = 400 Mbps ÷ per-user download
```

---

## 1. Audio

Opus ~**64 kbps** per stream. Each person hears the other `k-1` → per-user download
= `(k-1) × 64 kbps`.

| Room | Per-user | **Max concurrent users** |
|------|----------|--------------------------|
| 1-on-1 | 64 kbps  | **~6,250** |
| 5      | 256 kbps | **~1,560** |
| 10     | 576 kbps | **~690**   |

*With voice activation / DTX (silence sends almost nothing), real load is 2–4× lower.*

---

## 2. Video (camera)

**Simulcast + active speaker:** each viewer gets the speaker in HD + everyone else as
180p thumbnails → per-user download = `HD + (k-2) × 0.15 Mbps`.
(720p HD = 1.5 Mbps · 1080p HD = 3 Mbps.)

| Room | 720p /user | **Max (720p)** | 1080p /user | **Max (1080p)** |
|------|-----------|----------------|-------------|-----------------|
| 1-on-1 | 1.5 Mbps  | **~266** | 3.0 Mbps  | **~133** |
| 5      | 1.95 Mbps | **~205** | 3.45 Mbps | **~116** |
| 10     | 2.7 Mbps  | **~148** | 4.2 Mbps  | **~95**  |

> **How simulcast works:** each camera publishes *several* copies of its video at once
> — e.g. 1080p, 360p and 180p. All layers go up to the SFU, which sends **each viewer
> only the layer they need**: 180p for a small thumbnail, 1080p for the full-screen
> speaker — and switches layers live if someone's network drops. Without it the SFU
> would push full HD to everyone, even tiny tiles. Cost: the publisher uploads a bit
> more; the server's *download* (the binding limit) drops a lot.

---

## 3. Streaming (screen share)

One presenter per room → **one** stream sent to the other `k-1` viewers. Much lighter
than camera, because only one person publishes. Bitrates are the app's current 60 fps screen-share
tiers (`web/lib/mediaPrefs.ts`): 720p = **4.5 Mbps** · 1080p = **6.5 Mbps** · 1440p = **12 Mbps** ·
2160p = **15 Mbps**.

| Room | 720p /user* | **Max** | 1080p /user* | **Max** | 1440p /user* | **Max** | 2160p /user* | **Max** |
|------|------------|---------|--------------|---------|--------------|---------|--------------|---------|
| 1-on-1 | 2.25 Mbps | **~177** | 3.25 Mbps | **~123** | 6.0 Mbps  | **~66** | 7.5 Mbps  | **~53** |
| 5      | 3.6 Mbps  | **~111** | 5.2 Mbps  | **~76**  | 9.6 Mbps  | **~41** | 12.0 Mbps | **~33** |
| 10     | 4.05 Mbps | **~98**  | 5.85 Mbps | **~68**  | 10.8 Mbps | **~37** | 13.5 Mbps | **~29** |

*\*averaged over the room — each viewer downloads the full stream, the presenter 0. Every
participant is in the room's share, so this is the all-rooms-sharing worst case.*

---

## Summary (10-person rooms, one machine)

| Mode | Max concurrent users |
|------|----------------------|
| Audio | ~690 |
| Video 720p | ~148 |
| Video 1080p | ~95 |
| Streaming 720p | ~98 |
| Streaming 1080p | ~68 |
| Streaming 1440p | ~37 |
| Streaming 2160p | ~29 |

**Note:** the dev config currently caps you at ~60 users (LiveKit exposes only 61 UDP
ports) — a one-line fix (single-port UDP mux). After that, bandwidth is the wall, and
adding a second machine doubles every number.
