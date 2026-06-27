# Belt Type Matrix — all 14 types

Date: 2026-05-28
Source: `Conveyor Belts Type` sheet (the C-column status notes are Jitesh's own) + the 6 detailed costing sheets.

> **The key insight that makes "all 14 types" achievable:** there is essentially **ONE base calculation engine** (the multiply belt: covers + carcass fabric + skim + optional breakers). Every other belt type is that base **plus extra components** (cleats, sidewalls, blinkers, solution, hardener) and/or a **different length/quantity rule**. So we don't build 14 calculators — we build **one engine** and each Belt Type **declares** which components and rules apply. This is why the Belt Type master has a `components[]` list.

---

## The component library (every belt is assembled from these)

| Component | Weight driver | Cost driver | Notes |
|---|---|---|---|
| `TOP_COVER` | width × top-thk × SG × length | × cover compound ₹/kg | |
| `BOTTOM_COVER` | width × bottom-thk × SG × length | × cover compound ₹/kg | now separately selectable |
| `FABRIC` (carcass) | width × (GSM/1000) × plies × length | × fabric ₹/kg | from Belt Rating |
| `SKIM` | (belt-wt-without-breaker − cover − fabric) | × skim compound ₹/kg | "remainder" method (Excel F53) |
| `BREAKER_TOP` | width × (GSM/1000) × plies × length | × breaker ₹/kg | optional |
| `BREAKER_TOP_SKIM` | width × skim-thk × SG × length | × skim compound ₹/kg | optional |
| `BREAKER_BOTTOM` | width × (GSM/1000) × plies × length | × breaker ₹/kg | optional |
| `BREAKER_BOTTOM_SKIM` | width × skim-thk × SG × length | × skim compound ₹/kg | optional |
| `CLEAT` | cleat wt/m (or custom SG calc) × length | × cleat compound ₹/kg | Chevron, Steep Angle |
| `SIDEWALL` | sidewall wt/m × 2 sides × length + 10% wastage | × sidewall compound ₹/kg | Steep Angle, Sidewall |
| `BLINKER` | wt/piece × no. of blinkers | × blinker compound ₹/kg | Steep Angle |
| `SOLUTION_CLEAT` | per-cleat solution × no. of cleats | × solution ₹/kg | Steep Angle |
| `SOLUTION_SIDEWALL` | per-m solution × sidewall length | × solution ₹/kg | Steep Angle, Sidewall |
| `HARDENER` | 10% of total solution | × hardener ₹/kg | Steep Angle, Sidewall |
| `CleatProfile` (geometry) | — | — | drives cleat count/spacing, not weight directly |

Plus universal cost lines on every belt: **Cost of Production** (₹/kg × total weight), **Packing** (₹/m × length), **Freight** (rate × weight or area).

---

## The 14 belt types

Status legend (Jitesh's own notes in the sheet): **Done** = detailed sheet exists & validated · **Same as 7** = uses base multiply engine · **Hold** = needs spec work.

| # | Belt Type | Jitesh's note | Calc family | Components beyond base | Length/qty rule |
|---|---|---|---|---|---|
| 6 | **Multi-Ply Textile** | Done | BASE | covers + fabric + skim (no breaker) | open-end 3% |
| 7 | **Multi-Ply with Breaker** | Done ⭐ | BASE+BRK | + breaker top/bottom + their skims | open-end 3% |
| 1 | **Bag Diverter** | Same as 7 | BASE+BRK | same as Multiply (±breaker) | open-end 3% |
| 2 | **Bucket Elevator** | Same as 7 | BASE+BRK | same; often punched holes (see Q) | open-end 3% |
| 11 | **Straight Warp** | Same as 7 | BASE | special single-ply straight-warp carcass | open-end 3% |
| 10 | **Rough Top** | Same as 7 | BASE | **texture = thicker top cover** (extra mm cover compound — locked) | open-end 3% |
| 14 | **Wavy Top** | Same as 7 | BASE | texture = thicker/patterned top cover (extra mm) | open-end 3% |
| 4 | **Endless** | Same as 7, qty change | BASE | same components | **endless splice (+3 m flat — locked)** |
| 5 | **Jointless** | Same as 7, qty change | BASE | same; woven endless carcass | **endless splice (+3 m)** |
| 3 | **Chevron** | Done | BASE+CLEAT | + cleats (V-profile on top cover) | open-end 3% |
| 13 | **Steep Angle** | Done ⭐ | FULL | + cleats + sidewalls + blinkers + solution + hardener | moulded edge |
| 12 | **Sidewall** | Same as 13, no cleat | SIDEWALL | + sidewalls + solution + hardener | moulded edge |
| 8 | **Paper Reel** | Hold → **v2** | BASE? | deferred to v2 | TBD |
| 9 | **Pipe** | Hold → **v2** | BASE+PIPE | tube-forming geometry — deferred to v2 | TBD |

> **Locked with Jitesh:** Rough Top & Wavy Top are just the BASE engine with a **larger top-cover thickness** (the texture is extra cover-compound rubber) — no separate component, no new family. This collapses former "BASE+RT" into BASE. **Pipe & Paper Reel are v2** — build the other 12 first. **Endless splice = +3 m flat.**

### Calculation families (what we actually build)
1. **BASE** — covers + fabric + skim. (Multiply, Straight Warp, Endless, Jointless, **Rough Top, Wavy Top** — these just use a thicker top cover)
2. **BASE+BRK** — base + breakers. (Multiply-with-Breaker, Bag Diverter, Bucket Elevator)
3. **BASE+CLEAT** — base + cleats. (Chevron)
4. **SIDEWALL** — base + sidewalls + solution + hardener. (Sidewall)
5. **FULL** — base + cleats + sidewalls + blinkers + solution + hardener. (Steep Angle)
6. **BASE+PIPE** — base + tube geometry. (Pipe — **v2**)

All families share the same cover/fabric/skim/breaker core. Build the core once; switch components on/off per belt type. **v1 covers families 1–5 (12 belt types); family 6 (Pipe) + Paper Reel are v2.**

---

## Open questions (per belt type)

**Resolved with Jitesh:**
- ✅ **Rough Top / Wavy Top** — texture = thicker top cover (extra mm of cover compound). No separate component.
- ✅ **Pipe / Paper Reel** — deferred to v2.
- ✅ **Endless splice allowance** — +3 m flat.

**Still open (lower priority — needed before building those specific types):**
1. **Bucket Elevator** — does costing include hole-punching / extra reinforcement, or is it just a heavy multiply belt with breakers?
2. **Straight Warp** — is the carcass a single special fabric (one "ply" with its own GSM/thickness/price), so it bypasses the per-ply×plies math? Confirm fabric handling.
3. **Pipe (v2)** — will need tube geometry (overlap %, formed diameter → effective width) when we build it.
4. **Paper Reel (v2)** — what makes it different from a standard multiply belt? (Surface finish? Tolerances?)

---

## How this appears to the user (UX)

1. User picks **Belt Type** first (e.g. "Steep Angle").
2. The form **reveals only the relevant component sections** — Steep Angle shows cleat, sidewall, blinker, solution, hardener inputs; Multiply hides them.
3. Each revealed section's compound dropdown is **filtered by role** (cleat section → CLEAT compounds first, etc.) with the recommended-first + warning behaviour.
4. The engine sums only the declared components. No belt type ever shows a stray "cleat cost = 0" line it doesn't use (fixes the residual-cell problem from the Excel where Sidewall sheet still carried cleat cells).
