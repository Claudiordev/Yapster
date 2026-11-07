# Voice Infra & Pricing — Summary

Self-hosted LiveKit relaying voice + screen share. **Network traffic is the only bottleneck**
(CPU/RAM ignored). All numbers are calculations, not load tests.

## 1. What one server holds

Screen-share bitrates in the app (`web/lib/mediaPrefs.ts`, 60 fps):

| Resolution | Bitrate | Who |
|---|---|---|
| 720p | 4.5 Mbps | Free |
| 1080p | 6.5 Mbps | Free (default) |
| 1440p | 12 Mbps | Premium |
| 2160p | 15 Mbps | Premium |

A 6-person call with 1 sharer costs `6 x bitrate + 2 Mbps` of traffic. A server with 2 Gbps
(90% usable) holds:

| Resolution | Calls per server | People in calls at once |
|---|---|---|
| 720p | 62 | 372 |
| 1080p | 43 | **258** |
| 1440p | 24 | 144 |
| 2160p | 19 | 114 |

Servers compared (OVH): **Box C, 2 Gbps for €12/mo, is the best value** (A: 1 Gbps €10, B: 3 Gbps
€23). The dedicated Epyc (500 Mbps, €38.99) is ~14x worse per call for voice — use it for game
servers, not voice. We assume the €15 server also has 2 Gbps; **verify this.**

## 2. Pricing and break-even

- **Premium: one plan, €7.99/mo**, unlocks 1440p + 2160p. Free keeps 720p / 1080p.
- Net per paying user: **~€7.41** (after payment fees).
- Server: **€15/mo** (€14.25 on a 6-month commit, 5% off; €12.75 on a 12-month commit, 15% off).

| | Payers needed to cover 1 server |
|---|---|
| Monthly (€15) | 3 |
| 6 or 12-month commit | **2** |

Committing costs cash up front (€153 for 12 months) — stay monthly until paying users are steady.
Two servers for redundancy needs 4 payers (committed) or 5 (monthly).

## 3. Real cases: how many users pay?

| App | Paying share | Note |
|---|---|---|
| Dropbox | ~2.6% | 18.1M paying of ~700M registered ([10-K](https://www.sec.gov/Archives/edgar/data/1467623/000146762324000008/dbx-20231231.htm); registered count is a third-party figure) |
| Discord | ~3% (range 2.5-7%) | Nitro; **not published**, third-party estimate ([Sacra](https://sacra.com/c/discord)) |
| Duolingo | ~9% | 12.7M paid vs ~138M monthly users ([Q2 2026 filing](https://www.sec.gov/Archives/edgar/data/0001562088/000162828026053299/q2fy26duolingo6-30x26share.htm)) |
| Freemium benchmark | 3-5% good, 8-12% great | [ChartMogul](https://chartmogul.com/reports/saas-conversion-report/); a third of products land at 2.5-5%, a fifth below 2.5% |

Discord's rate comes with a huge network effect. **Plan for 1-2%, treat 3% as the good case.**

Active users needed for 2 paying users: 200 at 1%, 100 at 2%, ~67 at 3%. Aim for 3-4 payers
(150-300 users at 1-2%) as a safety margin. "Active" means monthly active, not signups.

## 4. Users, servers and net profit

Servers are sized for a normal-night peak of 5% of active users in a call, **all at 1080p** (one
server holds 258 in calls; at 2160p it holds only 114, so a 5,160-user base would need 3 servers
and 20,000 would need 9 if every call were 2160p). Only premium payers can use 2160p, so real
numbers sit close to the 1080p case. Net profit = payers x €7.41 − servers x €15, before VAT and
other infra.

| Active users | Servers | 0.5% pay | 1% pay | 2% pay | 3% pay (Discord) |
|---|---|---|---|---|---|
| 2,000 | 1 (€15) | 10 → **€59** | 20 → **€133** | 40 → **€281** | 60 → **€430** |
| 5,160 | 1 (€15) | 26 → **€178** | 52 → **€370** | 103 → **€748** | 155 → **€1,134** |
| 20,000 | 4 (€60) | 100 → **€681** | 200 → **€1,422** | 400 → **€2,904** | 600 → **€4,386** |

Cells show payers → net profit per month. Reaching 600 payers at 3% takes 20,000 active users;
at 1% it takes 60,000.

- 5,160 users is exactly one server's limit at a 5% peak; a busy night (10%) needs 2 servers.
- Server cost is ~10% of revenue or less at 1%+ conversion. **The risk is getting users and
  conversion, not infra cost.**

## 5. Events (Among Us first)

Events are a separate cost from infra: voice is cheap, **the prizes are the real cost.** The app
already has an entry fee and a prize pool per event, and a "Support the prize pool" button.

Plan: Among Us rooms of 15, **2-3 events a day**, prize pool of €0.50 or €1 per event, paid from
net profit. That is 30-45 players a day.

**Servers:** audio only, ~13 Mbps per room, so 3 rooms is ~40 Mbps, about 2% of one server.
Events need no extra servers.

**Paying users needed** (payers = (prizes + €15 server) ÷ €7.41 net per payer):

| Events/day | Pool per event | Prizes per month | Payers needed | Active users at 1% pay | Active users at 2% pay | Active users at 3% pay |
|---|---|---|---|---|---|---|
| 2 | €0.5 | €30 | **7** | 700 | 350 | 233 |
| 2 | €1 | €60 | **11** | 1,100 | 550 | 367 |
| 3 | €0.5 | €45 | **9** | 900 | 450 | 300 |
| 3 | €1 | €90 | **15** | 1,500 | 750 | 500 |

For comparison, 10 events a day would need 23-43 payers (1,150-2,150 active users at 2%).

A €1 pool is ~€0.07 per player, which is not much of a draw. Fewer, bigger events (e.g. 2 a day
at €5) get more attention for the same money.

**Where to make money without upsetting users** (best first):

1. **Free entry, platform-funded prizes at the start.** Treat the prize budget as marketing:
   events bring players in and Premium turns some of them into payers. Take no cut.
2. **Prizes as Premium days first, cash later.** At €0.50-1 pools a player wins ~€0.07 per
   event, so a €10 cash payout takes months. Cash payouts (min €10, via Stripe or Swish) and the
   data the winner must give are in `payouts-sweden.md`. Don't hold withdrawable balances for
   winners (may need a payment licence); track prizes owed and pay from your own account.
3. **Community top-ups to the prize pool** (the Support button) with a ~10% platform fee on the
   top-up only, never on the prize you fund yourself.
4. **Premium perks, not paid entry:** Premium-only events with bigger pools, or a bonus on
   events for Premium players. These pay for themselves through Premium revenue.
5. **Entry fees later, if ever.** A €1 card payment loses ~€0.30 to fixed fees, so it needs an
   in-app balance, and it raises the legal risk below.
6. **Sponsors** paying for a prize pool, once there are enough players to be worth it.

**Check before paying real money:** cash prizes plus an entry fee can count as gambling, and
Among Us has a strong luck element (random roles). Free entry with platform-funded prizes is the
lower-risk start, but get legal advice first. Payout, tax and identity requirements for Sweden
are in `payouts-sweden.md`.

## 6. Positioning

- **Free: 1080p.** Beats Discord's paywalled resolution — a clean hook.
- **Premium: 1440p + 2160p**, gated because a free better-than-1080p option would drive high
  concurrency, where free-tier cost is hardest to control.
- **Real differentiator vs Discord: bundled game-server hosting** (Minecraft, CS:GO). Niche:
  clans already paying a separate game host. Game hosting needs dedicated servers and DDoS
  protection — a separate cost line not included here.

## 7. To verify

1. Real traffic per call: measure Mbps on a 6-person, 1-sharer call at each tier.
2. Real guaranteed bandwidth of the €15 server (assumed 2 Gbps).
3. Real peak concurrency (5% is a guess) and room size (bigger rooms cost more per sharer).
4. Events: legal check on cash prizes and payout processing fees before any real payout.
5. Not included: VAT on €7.99, game hosting, database/chat/Keycloak infra, domain, monitoring.
