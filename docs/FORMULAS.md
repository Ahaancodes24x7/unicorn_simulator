# Game formulas

All numbers are simulated game parameters, not real-world benchmarks. One turn is one simulated month.
The source of truth is [`src/game/metrics.ts`](../src/game/metrics.ts), [`src/game/scoring.ts`](../src/game/scoring.ts) and [`src/game/engine.ts`](../src/game/engine.ts); keep this page in sync with them.

## Team skills and crews

Each hire adds its role's skill values (see the hiring catalog). Every task lists the roles it needs (`crew`) and a crew limit
(`crewMax`, default: required roles + 1, at least 2). Before a task, the team assigns employees: the crew must include one of each
required role and stay within the limit, and **only the assigned crew's skills** count for the roll and for customer gains.
On task rolls, each skill counts up to **4**.

| Task | Required roles | Crew limit |
|---|---|---|
| Research | CEO | 2 |
| MVP | Engineer | 2 |
| Lean pilot | Sales | 2 |
| Premium pilot | CEO, Sales | 3 |
| Compliance | Operations | 2 |
| Growth push | Marketing | 2 |
| Product v2 / Platform v3 | Engineer, Product | 3 |
| Partnership | CEO, Sales | 3 |
| Pricing | Finance | 2 |
| Scale | Engineer, Operations | 3 |
| Expansion | Sales, Marketing, Operations | 5 |
| Global | CEO, Sales, Marketing | 6 |
| Process audit | Operations | 2 |
| Consulting sprint, Reputation recovery | none | 2 |

## Task resolution (deterministic + controlled variance)

```
capability  = Σ(weight_s × min(skill_s, 4) / 4) / Σ weight_s      (0.5 if the task needs no skills)
roll = 40
     + 40 × capability                       team fit
     − (difficulty − 50) × 0.6               task difficulty
     + readiness                             +5 if runway ≥ 3 turns or profitable, 0 if ≥ 1, −8 otherwise
     + (reputation − 50) / 10
     − risk / 10
     + uniform(−variance, +variance)         seeded: "<team seed>:<turn>:<nonce>:<action>"
roll ≥ 62  → success (profitable or strategic, depending on the task)
roll ≥ 42  → partial success
otherwise  → failure
```

Every roll is stored with its seed and the full breakdown in the team timeline, so any result can be re-derived.
After the task, there is an `eventChance` probability (default 15%) of a critical event, drawn by weight from the track's and the global event pools.

Customer gains are multiplied by `1 + 0.08 × min(sales + marketing, 8)`, using the assigned crew's skills.

## End of turn

```
revenue       = customers × ARPU × (1 + arpuBonus%)
direct costs  = revenue × (1 − gross margin)
gross margin  = track margin + marginPts + 1% × min(ops, 4)              (clamped 5–95%)
cash         += revenue − direct costs − payroll
churn rate    = base churn + churnPts − 0.5% × product − 0.2% × min(product skill, 4)   (clamped 1–50%)
churned       = floor(customers × churn rate + rand)                     (stochastic rounding)
```

A task can only be chosen if `cash − cost + min(0, projected net) ≥ 0`, so cash never goes below zero unless overdraft is enabled. Negative outcome cash effects are capped at the cash available.

## Unit economics

```
CAC        = acquisition spend ÷ customers acquired
             (acquisition-task costs + sales/marketing hiring fees and salaries)
LTV        = ARPU × gross margin ÷ churn rate
burn       = payroll + direct costs              (gross, per turn)
net burn   = burn − revenue
runway     = cash ÷ net burn                     ("Profitable" when net burn ≤ 0)
```

## Valuation vs net worth

```
ARR        = revenue × 12
growth     = (revenue − revenue 3 turns ago) ÷ revenue 3 turns ago     (clamped 0–3)
multiple   = 5 + 3 × growth + (reputation − 50)/10 + (2 if LTV:CAC ≥ 3)   (clamped 2–20)
strategic  = Σ milestone values + product² × $10,000
valuation  = max( (ARR × multiple + strategic + cash) × (1 − risk/250),  0.6 × last post-money,  cash )

net worth  = assets − liabilities = cash     (no debt is modelled)
founder equity value = valuation × founder ownership
```

## Fundraising

Rounds are sequential (Pre-seed → Seed → Series A → Series B → Series C+). The next round unlocks when all of its criteria pass. Pitching uses a turn and is rolled with weights strategy 2, finance 1, sales 1: success gives 3 offers, partial 2 (≈10% lower pre-money), failure none.

```
pre-money       = clamp(valuation × uniform(0.85, 1.30) × quality, round range)
ownership sold  = uniform(round dilution range)
investment      = pre-money × sold ÷ (1 − sold)
post-money      = pre-money + investment
ownership sold  = investment ÷ post-money
founders        = founders × (1 − ownership sold)
```

Offers with a growth mandate set a customer target (`max(customers × multiplier, customers + 5)`) due after N turns. Meeting it gives +3 reputation; missing it costs the penalty and +5 risk.

## Composite score

Each component is normalised to 0–100, then weighted (weights are normalised to 100%).

| Component | Default weight | 0–100 formula |
|---|---|---|
| Final company value | 25 | log scale: $10k → 0, $1B → 100 |
| Profitability & unit economics | 20 | ½ × min(LTV:CAC / 5, 1) × 100 + ½ × (50 + 50 × (revenue − costs) / max(revenue, costs)) |
| Customer traction | 15 | 0.6 × log(customers vs track target) + 0.4 × log(revenue, $100k/turn = full) |
| Execution / task completion | 15 | 60 × hit-rate (partials count ½) + min(40, 3 × milestones) |
| Capital efficiency / runway | 10 | ½ × min(runway / 12, 1) × 100 + ½ × log(valuation ÷ capital in, 1× → 0, 100× → 100) |
| Fundraising & ownership quality | 5 | bootstrapped 30; otherwise 60 × ownership + 40 × min(rounds / 3, 1); −15 per missed target |
| Risk, reputation & resilience | 10 | 0.7 × reputation + 0.3 × (100 − risk) |

`total = Σ weighted components + admin adjustment`. Ties break on profitability, then runway, then execution.
Every turn writes a metrics snapshot and a `score` timeline entry (from → to, reason, timestamp). Manual adjustments are recorded in both the team timeline and the audit log.
