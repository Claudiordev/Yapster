# Event Prize Payouts in Sweden — What's Needed

Research notes for paying event winners (Among Us first) from a Swedish company. **Not legal or
tax advice** — items marked ⚠ are not confirmed and need an accountant / lawyer before launch.
Related: `infra-capacity-planning.md` section 5 (event budget).

## 1. Short answer

- **At €0.50-1 pools, don't pay cash yet.** An average player wins ~€0.07 per event (€1 ÷ 15), so
  reaching a €10 payout takes months. Pay winners in **non-cash prizes (Premium days)** first.
- **Non-cash prizes are simpler.** A non-withdrawable prize worth up to 1,800 SEK per win is tax
  free for the winner, and you need no payout provider and no identity data.
- **When you do pay cash:** minimum payout **€10 (~110 SEK)**.
- **Quickest:** Swish utbetalningar (money arrives directly). **Cheapest:** Swish per payout
  (2.50 SEK) but it has a 60 SEK monthly fee; Stripe Connect has no monthly fee. Swish is cheaper
  once you do about 22+ payouts a month.
- **Cash prizes are taxable** and the payer reports them to Skatteverket, so you must collect the
  winner's personnummer.

## 2. What the winner must fill in (cash payouts only)

Ask for this once, at the first withdrawal, not at signup:

| Field | Why |
|---|---|
| Full legal name | payout + tax report |
| Personnummer | Swish payout needs it; tax reporting to Skatteverket |
| Phone number registered to Swish | Swish payout |
| Bank account (IBAN) | if paying through Stripe/bank instead of Swish |
| Confirm 18+ and Swedish tax residence | prize rules, non-Swedes need another route |
| Accept the prize terms + tax-reporting notice | consent |

If you use Stripe Connect, Stripe collects its own identity details during onboarding (name,
date of birth, address, ID number, bank account), which also covers the identity check.
Store the personnummer encrypted, only for paid winners, and delete it when no longer needed (GDPR).

## 3. Tax and reporting (Skatteverket)

- Whether a win is a **competition prize** (your performance decides) or a **lottery** (chance
  decides) matters. Mixed games are judged by how they end. Among Us has a lot of luck, so
  classification is not obvious ⚠.
- **Cash prizes are taxable** as income from employment/assignment ("inkomst av tjänst"),
  whatever the amount. Skatteverket's example: a 1,500 SEK cash prize is taxable.
- **Non-cash prizes** (not exchangeable for money, not from an employer or assignment) are
  tax free up to **1,800 SEK per win** (2025 and 2026). Above that the whole value is taxable.
- For taxable prizes the **payer reports the value to Skatteverket** so it appears in the
  winner's tax return. The Skatteverket pages do not state whether you must also withhold tax or
  pay employer contributions on prize money ⚠. Ask an accountant, and ask whether there is a
  minimum amount below which no report is needed ⚠.
- Keep records of every prize paid (who, when, how much) for at least 7 years.

Sources: [Winnings in games and competitions](https://www.skatteverket.se/privat/skatter/arbeteochinkomst/inkomster/vinsterispelochtavlingar.4.7459477810df5bccdd4800015166.html),
[E-sport, gaming and streaming](https://www.skatteverket.se/privat/skatter/arbeteochinkomst/inkomster/esportspelochstreaming.4.41f1c61d16193087d7f125cd.html)
(Skatteverket).

## 4. Payout options

| | Swish utbetalningar (via your bank, e.g. SEB) | Stripe Connect |
|---|---|---|
| Speed | Directly to the winner's Swish | Normal payout; typically a few business days ⚠ |
| Fee | 2.50 SEK per payment + 60 SEK/month | 0.25% + 5 kr per payout; 15 kr per active account/month only if you set your own pricing |
| Winner needs | Swedish personnummer + Swish phone number | Stripe onboarding + bank account |
| You need | Swedish bank agreement, Swish API integration | Stripe Connect integration |
| Limits | 30,000 SEK per payment | n/a |
| Who it works for | Swedish residents only | Many countries |

Fees at 11 SEK per € (assumption, check the rate):

| Payout | Swish | Stripe |
|---|---|---|
| €5 | 2.5 SEK = 4.5% | 5.1 SEK = 9.3% |
| €10 | 2.5 SEK = 2.3% | 5.3 SEK = 4.8% |
| €20 | 2.5 SEK = 1.1% | 5.6 SEK = 2.5% |

Swish's 60 SEK monthly fee is cancelled out by its per-payout saving at about **22 payouts a
month**. Below that, Stripe is cheaper overall; above it, Swish is. Swish is always the fastest.

Sources: [SEB Swish utbetalningar](https://seb.se/foretag/digitala-tjanster/swish-foretag/swish-utbetalningar),
[Stripe Connect pricing (Sweden)](https://stripe.com/se/connect/pricing). Other banks' Swish
payout prices may differ ⚠.

## 5. Minimum payout

**€10 (~110 SEK).** The fee is 2-5% at that size and falls below 2.5% at €20. Below €5 the
fee eats more than 5-9% of the prize.

Don't hold winners' money yourself in a withdrawable balance: that can count as a payment
service or e-money under Finansinspektionen's rules and need a licence ⚠. Instead:
- record prizes **owed** in your own ledger (it is your debt to the winner, not their funds), and
- pay the winner from your own account through Swish or Stripe when they claim €10+.

## 6. What to build in the app

1. **Prize ledger:** per user, prizes earned, claimed and paid, per event.
2. **Payout profile** (section 2), shown only when a user claims a cash prize.
3. **Claim button** that unlocks at €10 owed, with the terms and tax notice.
4. **Payout provider integration** (Stripe first, Swish later) with a status per payout.
5. **Yearly tax report export:** total cash prizes per winner, with personnummer, for the
   accountant to report.
6. **Event and prize terms:** age limit, one account per person, prize rules, what happens on
   cheating or collusion (Among Us is easy to team up in).
7. **Fraud guard:** hold payouts a few days and require a verified identity before the first one.
8. **Company set-up:** a Swedish AB with a business bank account (needed for Swish payouts).

## 7. Rollout

1. **Now:** non-cash prizes (Premium days) from the platform. No KYC, no payout provider.
2. **Pools of €5+ and users asking for cash:** cash payouts through Stripe Connect, min €10.
3. **22+ payouts a month:** add Swish utbetalningar.
4. **Entry fees or community top-ups:** only after a legal check (gambling rules).

## 8. Confirm with an accountant / lawyer before cash payouts ⚠

1. Is Among Us (random roles) a competition or a lottery for tax, and does it fall under
   Spelinspektionen's gambling rules? Free entry with platform-funded prizes is the lower-risk
   start, but verify.
2. Do you need to withhold tax or pay employer contributions on prize money, and from what
   amount do you have to report?
3. Does the prize-ledger setup avoid needing a payment licence?
4. Are Premium days given as a prize counted as a non-cash prize under the 1,800 SEK limit?
