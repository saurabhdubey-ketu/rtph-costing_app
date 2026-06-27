# Phased Build Plan

Date: 2026-05-28

> **Scope reminder:** v1 delivers **all 12 well-understood belt types** (Pipe + Paper Reel are v2). "Phasing" here is about **build order**, not cutting scope — it sequences the work so the team has something testable early and validates correctness before piling on breadth.

> **Guiding rule for the team:** *Masters before engine. Engine before breadth. Breadth before packaging. Packaging before polish. Integration last.* Don't build belt type #2 until belt type #1 reproduces the Excel to the rupee.

---

## Phase 0 — Foundation & Masters (the bedrock)
Nothing computes without masters. Build them first, with full CRUD + audit + price history.

- Login + users (basic; full role matrix is Jitesh's separate discussion — leave seams for it)
- **Compound master** — code, name, roles[], chemical_category, grade specs, SG, price/kg, price_source, status, price history, `ravasco_compound_id` (null for now)
- **Cover↔Skim compatibility** table (family + per-compound matches)
- **Fabric** (3 levels: Type, per-ply, Belt Rating), **Fabric Supplier**, **Breaker**
- **Edge**, **Reel/Packing**, **Freight Zone**, **Cost-of-Production** (per belt type), **Belt Type** (components[] + wastage rules)
- **Customer**, **Currency/Exchange rate**

**Acceptance:** an admin can create/edit every master; changing a price writes a history row; archived items vanish from new-quote pickers but remain visible on old records.

---

## Phase 1 — Engine + ONE belt type (Multiply with Breaker ⭐)
Prove the whole vertical slice on the belt you've already validated in Excel.

- The **calculation engine** (the single core: covers, fabric, skim, breakers, totals, RMC)
- Belt input form for Multiply-with-Breaker
- Component dropdowns: **role-filtered**, **skim recommended-first + mismatch warning**, top/bottom cover independently selectable
- Live cost breakdown, RMC, **Standard + VD** prices side by side
- Hard-validation: missing master → visible block, never silent zero (fixes the IFERROR(...,0) danger)

**Acceptance:** enter the same spec as a known Excel costing and match the **corrected Excel** (`07`) to the rupee. This is the correctness gate for everything after.

---

## Phase 2 — The other 11 v1 belt types
Each is "declare components + reuse engine." No new math except the family-specific bits already specified in `04`.

Order (easy → complex):
1. Multi-Ply (no breaker), Bag Diverter, Bucket Elevator, Straight Warp — pure base/base+breaker
2. Rough Top, Wavy Top — base with thicker top cover
3. Endless, Jointless — base with +3 m splice rule
4. Chevron — base + cleats
5. Sidewall — + sidewalls + solution + hardener
6. Steep Angle — + cleats + sidewalls + blinkers + solution + hardener (the FULL family)

**Acceptance:** each type reproduces its Excel sheet (for the 4 that have one) or its agreed formula; the form shows only that type's component sections (no stray cleat/sidewall lines).

---

## Phase 3 — Quotation packaging + the rate freeze
Turn costings into customer quotations.

- Customer → Quotation → **multiple belt lines**
- Pick Standard or VD per line → discount → **final price** (the headline)
- **Rate snapshot on SEND** — freeze every master rate onto the lines
- **Revisions** as versioned records (Revised-1, -2 …), old versions preserved

**Acceptance:** send a quote; change a compound price in masters; reopen the sent quote → numbers unchanged. Create a revision → both versions visible.

---

## Phase 4 — Outputs & tracking
- **Quotation PDF** (customer-facing, branded per Indus/HRS)
- **Cost sheet** (internal breakdown by component)
- **Won/Lost** + **optional** PO tracking (order rate, PO status, agent, actual GP)
- **Currency** display for export quotes

**Acceptance:** generate a branded quote PDF; mark a quote Won with an order rate; see actual GP vs quoted.

---

## Phase 5 — Ravasco integration (later — the payoff)
The step that makes prices live.

- Admin links each costing-compound to a Ravasco `Compound`
- Pull **price/kg** from Ravasco `CompoundVersion.cachedCostPerKg` (APPROVED only) and **SG** from the `G_PER_CM3` property
- Flip `price_source → RAVASCO_COMPUTED` (price/SG become read-only in costing app)
- Optionally pull fabric/RM prices too

**Acceptance:** change a raw-material price in Ravasco → the linked compound re-prices → new belt quotes reflect it (sent quotes stay frozen).

---

## v2 (after v1 is in daily use)
- **Pipe** belt (tube geometry) + **Paper Reel**
- Plant-level cost-of-production
- Advanced reports: win-rate, margin trends, price-list generation
- Bulk price updates, compound where-used

---

## Validation strategy (how the team proves correctness)
- The **corrected Excel** (`07-corrected-excel-spec.md`) is the **oracle**: every Phase-1/2 belt type must match it to the rupee for a set of test specs.
- Build a small **test pack**: ~10 real past quotes (varied types/widths/grades) with their expected numbers. Re-run them in the app at each phase.
- Edge cases to include: moulded vs cut edge, endless vs open-end, multi-ply high strength, a UHR (EPDM) belt to exercise skim mismatch, an export (USD) quote.

## A note on tech choice (recommendation, team's call)
Integration in Phase 5 is far easier if the costing app shares Ravasco's stack (Next.js + Fastify + Postgres + Prisma). Same database conventions, same money type (`Decimal(14,4)`), same auth pattern → linking the two is a join, not a bridge. Not mandatory, but it removes a whole class of future pain.
