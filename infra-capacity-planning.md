# Voice Infra Capacity & Pricing — Working Notes

Model: LiveKit (self-hosted SFU) relaying screen share + voice for a Discord-style voice/gaming app.
Numbers below mix **measured** data (from real usage on the current OVH VPS) with **labeled
assumptions** — check the "Confidence" column before trusting a number for a real decision.

## Measured data (source of truth)

| Data point | Value | Confidence |
|---|---|---|
| 6-person call, 2x 2160p sharers | 150 Mbps total traffic (in+out), 25% CPU | Measured |
| 2160p bitrate per stream | 25 Mbps (in and each forwarded copy) | Measured |
| 1080p bitrate per stream | 7.5 Mbps | Measured |
| 1440p bitrate per stream | 13 Mbps | Measured |
| 4-person call, 1 sharer, 1080p (7.5Mbps) | 7-9% CPU | Measured |
| 4-person call, 1 sharer, 2160p (25Mbps) | 7-9% CPU (same range as 1080p!) | Measured |

**Key finding:** CPU cost is ~resolution-independent — the 1080p and 2160p tests at the same
participant count gave the same CPU range despite 3.3x different bitrate. CPU is driven mainly
by **participant/connection count**, not by video bitrate. Bandwidth is still fully
resolution-dependent (that's basic physics, not in question).

**Unresolved:** fitting a clean formula (fixed-per-participant, fixed-per-call, fixed-per-sharer)
from the 3 CPU data points above produces mathematically inconsistent (negative) coefficients —
there isn't enough clean data yet to nail the exact functional form. The working estimate below
(6-person/1-sharer ≈ 9% CPU on a 4-core box) is an **interpolation, not a measurement**.
A direct test of that exact call shape is the single most valuable next measurement.

## VPS / server options compared

| Box | Cores | Bandwidth | RAM | Price/mo | Notes |
|---|---|---|---|---|---|
| **A** | 4 (assumed — unconfirmed) | 1 Gbps | 8 GB | €10 | OVH, "virtually isolated" vCores, 75GB disk |
| **B** | 8 | 3 Gbps | 24 GB | €23 | 200GB NVMe, daily backup, unlimited traffic |
| **C** ⭐ | 6 | 2 Gbps | 12 GB | €12 | 100GB NVMe, daily backup, unlimited traffic |
| **Dedicated** | 16c/32t (Epyc 7351P) | 500 Mbps | 128-256 GB | €38.99 | One-time install fee, waived on multi-month commit |

**Box C dominates A and B for this workload** — better €/core (€2.00 vs €2.50/€2.875) *and*
better €/Mbps (€0.006 vs €0.010/€0.00767) than both. It wins at every scale tested, not just on
rounding luck.

**The dedicated Epyc box is a poor fit for voice/SFU** (bandwidth-starved at 500Mbps — 5x worse
cost-per-slot than Box C) but is a plausible fit for **game server hosting** instead (bandwidth
matters far less there; game traffic is tiny compared to video). Caveats for that use: 2.4-2.9GHz
clock speed is low for single-threaded workloads like Minecraft's server loop; DDoS protection
terms and storage type (SSD vs HDD at the 8TB tier) are unconfirmed — verify with the provider
before committing.

## Capacity per machine (Box C: 6-core / 2Gbps / €12)

Call shape: 6-person room, 1 sharer + 5 watching, everyone on voice.

| Resolution | Traffic/call | Slots/machine | Bottleneck |
|---|---|---|---|
| 1080p | 47 Mbps | **15** | CPU |
| 1440p | 80 Mbps | **15** | CPU (same as 1080p — CPU doesn't care about resolution) |
| 2160p | 152 Mbps | **11.9** | Network |

## Cost scenarios (Box C fleet)

**1,000 users ALL simultaneously in calls** (167 rooms of 6, harsh "everyone shows up at once" ceiling):
- 1080p or 1440p: **12 machines, €144/mo**
- 2160p: needs more machines (network-bound at 11.9 slots vs 15)

**1,000 registered free users, 1% peak concurrency** (10 people sharing at once at peak — a much
more realistic "typical Saturday night" load than the above):
- 1080p: **€8.00/mo**

## Paid-tier economics

Assumptions: Stripe-style fee (2.9% + €0.30), paid user uses their higher-res tier ~5% of the
month, worst-case infra cost priced at 2160p.

| Price | Net profit/paying user |
|---|---|
| €3.99 | €3.52 |
| €7.99 | €7.41 |
| €9.99 | €9.35 |

**Paying users needed to cover free-tier cost (1,000 free users, 1% peak concurrency, €8/mo bill):**
1 paying user at any of the above price points (0.1% conversion) — sensitivity below.

**Paying users needed to cover the "1,000 concurrently in call" ceiling scenario (€144/mo bill):**

| Price | Paying users needed |
|---|---|
| €3.99 | 41 |
| €7.99 | 20 |

**Sensitivity of free-tier breakeven to the peak-concurrency guess** (1,000 free users, €3.99 price):

| Peak concurrency | Paying users needed | Conversion |
|---|---|---|
| 0.5% | 1 | 0.1% |
| 1% | 1 | 0.1% |
| 2% | 2 | 0.2% |
| 5% | 5 | 0.5% |
| 10% | 9 | 0.9% |

Even pessimistic concurrency stays under 1% conversion — infra cost for screen-share bandwidth is
not the binding constraint on this business's viability.

## Business positioning notes

- **Free tier: 1080p** (undercuts Discord Nitro's paywalled resolution — clean, understandable hook).
- **Paid tier: 1440p + 2160p.** The 1440p cost step (vs 1080p) is real but moderate — the reason
  to gate it isn't raw cost, it's that a *free*, noticeably-better-than-1080p option would see
  high adoption (high concurrency), which is exactly where free-tier cost is hardest to control.
- **Real differentiator vs. Discord: bundled game server hosting** (Minecraft, CS:GO), not the
  screen-share resolution tiers — Discord doesn't offer this at all. Screen share quality is a
  marketing hook; game hosting is the actual moat.
- **Target niche:** gaming clans/friend groups already paying a third-party game host separately
  from Discord — "one place instead of two" is a sharper pitch than "compete with Discord broadly."
- Game hosting infra should be **dedicated servers, not VPS** — different cost profile (CPU/RAM
  per instance vs. bandwidth-forwarding for voice) and needs DDoS protection as a hard requirement,
  not an afterthought.

## Open assumptions to verify (highest-impact first)

1. **6-person/1-sharer CPU%** — currently a 9% interpolation, not measured. Directly test this
   exact call shape.
2. **Original OVH box's real core count** — assumed 4 throughout; never confirmed against the
   actual OVH plan spec.
3. **CPU-scales-linearly-with-core-count** across box sizes — assumed, not tested on an actual
   6-core or 8-core box.
4. **Peak concurrency %** for the free tier — 1% is a guess with no real usage data behind it yet.
5. **Paid-user usage fraction** (~5% of the month) — also a guess.
6. **Dedicated Epyc box**: confirm DDoS protection terms and actual storage type (SSD/HDD) before
   considering it for game hosting.
