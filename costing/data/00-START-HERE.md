# Belt Costing Software — Specification (START HERE)

Date: 2026-05-28 · Author: Jitesh + Claude · Status: design locked, ready for team review

> **For the development team.** This folder is the build spec for a new belt-costing application. Read this document first, then the numbered docs. Every major decision was made with Jitesh and is marked **LOCKED**. Open questions are listed at the end and inside each doc.

---

## 1. What we're building (in one paragraph)

A web application that replaces two Excel files (a per-belt-type costing template and a 5,000-row dealer quotation log) with a single system where **masters drive every price**, **every belt type is costed by one shared engine**, and **sent quotations freeze their rates forever**. It covers **12 conveyor-belt types in v1** (Pipe + Paper Reel in v2), produces customer quotations with margins and revisions, and is designed to **later integrate with the Ravasco Formulations App** so that compound prices flow live from rubber recipes instead of being typed in.

## 2. Why the last 3 years didn't work — and why this will
The design was always sound; what was missing was an execution team. That now exists. This spec exists to **externalise the architecture from Jitesh's head into something a team can build**, with the business rules made explicit and the calculation bugs fixed.

## 3. The three principles everything follows
1. **Masters are the single source of truth.** No rate, SG, or wastage is ever typed inside a calculation. Every number comes from a master row. (Today's Excel hardcodes ₹80, ₹65, 1.18 etc. inside formulas — that ends.)
2. **One engine, many belts.** A belt type *declares* its components (cover, fabric, skim, breaker, cleat, sidewall…); the engine sums only what's declared. We build the core once.
3. **Quotes freeze on send.** A sent quotation snapshots all its rates and never changes, even when masters do. Revisions are new versions, not overwrites.

---

## 4. Locked decisions (the whole list)

**Scope**
- v1 = 12 belt types (all except Pipe & Paper Reel, which are v2).
- History from old Excel stays in Excel; new app starts fresh.
- Built standalone by the team now; integrates with Ravasco later.

**Compound master**
- Mirrors Ravasco's compound model so integration is a non-event. Price/kg + SG are typed now (`price_source = MANUAL`), pulled live from Ravasco's approved recipe later (`RAVASCO_COMPUTED`, read-only). Link via `ravasco_compound_id`.
- Compounds carry **roles** (TOP_COVER, BOTTOM_COVER, SKIM, CUSHION, SIDEWALL, CLEAT, BLINKER, SOLUTION, HARDENER, EDGE); a compound may hold multiple roles (= cross-use).
- **Top & bottom cover can be different compounds** (default same, override allowed).
- **Skim is one list.** Each skim tagged `skim_for` = Fabric and/or Steel Breaker. Skims match covers by grade family (GP/AR/HR/FR/OR/COLD/LRR) via the `cover_skim_compatibility` table — common (per-family) or unique (per-grade, e.g. UHR=EPDM).
- **Skim selection: never auto-filled.** Dropdown lists recommended (matching) skims first; choosing a non-matching skim warns and logs. *(This is the resolution of Jitesh's original ask.)*
- Cover grades hold full spec: family, polymer, tensile, elongation, abrasion, max-temp, standards, brand line (real Indus Belts grades).
- Solution = made or bought (`price_source` handles both); Hardener = always bought.

**Masters (supporting)**
- Fabric pricing = type-level default + per-fabric override. Multi-supplier in scope from v1.
- Cost-of-production rate = per belt type.
- Edge type drives width-wastage (Cut-Edge +30 mm, Moulded +0) — parametric, fixes a bug.

**Engine & pricing**
- One weight formula: `W_eff(m) × thickness(mm) × SG × L_eff(m)` for rubber layers; GSM-based for fabrics.
- Effective width adds edge wastage only for cut-edge. Effective length = open-end ×1.03, or endless +3 m.
- **VD price** = GP charged on material cost only (prod/packing/freight at cost).
- Quote shows **Standard + VD side by side**; sales picks; discount applied; **final price is the headline**.
- **No rounding** (remove MROUND).

**Quotation flow**
- One quotation → many belt lines.
- PO/Won-Lost tracking included but **optional**.
- Quote numbering format deferred to the team.
- Rate freeze on SEND; revisions are versioned.

**Bugs fixed (from the audit)** — all 8 critical bugs become acceptance criteria; see `01`.

---

## 5. Glossary (so the team speaks your language)

**Belt construction**
- **Carcass** — the load-bearing fabric core (the plies).
- **Ply** — one layer of carcass fabric. A "5-ply" belt has 5 fabric layers.
- **Cover** — the rubber on top (carrying side) and bottom (pulley side).
- **Skim** — thin rubber coating bonding fabric layers and bonding fabric to cover.
- **Breaker** — an extra reinforcement layer (fabric or steel) above the carcass for impact protection; can be on top and/or bottom, each with its own skim.
- **Cleat** — a raised rubber bar across the belt (Chevron/Steep Angle) to stop material rolling back.
- **Sidewall** — a corrugated rubber wall along belt edges to contain material on inclines.
- **Blinker** — a support web between cleats and sidewalls (Steep Angle).
- **Solution** — rubber cement for bonding cleats/sidewalls; **Hardener** — its curing agent.
- **Edge** — Cut-Edge (sliced, needs wastage) vs Moulded (sealed, no wastage).
- **Belt rating** — shorthand like `EP-1000/5`: fabric type EP, 1000 N/mm total strength, 5 plies.
- **GSM** — grams per square metre of a fabric. **SG** — specific gravity (density) of a rubber.

**Grade families (Indus Belts)** — GP (general purpose), AR (abrasion), HR (heat), FR (fire), OR (oil), COLD (frost), LRR (low rolling resistance).

**System / costing**
- **Master** — a reference table (compounds, fabrics, suppliers, freight…) that supplies rates.
- **RMC** — Raw Material Cost per meter (total belt cost ÷ length).
- **GP** — Gross Profit % added to cost. **VD** — margin on material cost only.
- **Rate snapshot / freeze** — frozen copy of all rates on a sent quote.
- **price_source** — whether a compound's price is typed (`MANUAL`) or pulled from Ravasco (`RAVASCO_COMPUTED`).

---

## 6. Document index
| Doc | Contents |
|---|---|
| `00-START-HERE.md` | This file — overview, locked decisions, glossary |
| `01-audit-findings.md` | Bugs in the current Excel + hardcoded-value inventory |
| `02-master-architecture.md` | All 13 masters: fields, links, the compound master in full |
| `02b-ravasco-compound-model.md` | How Ravasco models compounds; the "price from recipe" chain |
| `02c-indus-grades-and-skim-matching.md` | Real Indus grades + the cover↔skim matching engine |
| `03-belt-type-matrix.md` | 14 belt types → 5 build families; components per type |
| `04-calculation-engine.md` | Canonical formulas, all bugs fixed |
| `05-costing-and-quotation-flow.md` | Quote lifecycle, rate freeze, revisions, tracking |
| `06-phasing-plan.md` | Build order Phase 0→5 + v2; validation strategy |
| `07-corrected-excel-spec.md` | Spec for the bug-fixed Excel (QA oracle) — to be produced |

---

## 7. Consolidated open questions (to close with Jitesh / team)
1. **Bucket Elevator** — hole-punching / extra reinforcement in cost, or just a heavy multiply belt?
2. **Straight Warp** — single special fabric (own GSM/thickness/price) bypassing per-ply math?
3. **Approval gate** — is there a "manager approves before SENT" step? (Part of the separate permissions discussion.)
4. **v2 specifics** — Pipe tube geometry; what makes Paper Reel different.
5. **Seed data** — 10–15 real compounds (code, role, SG, ₹/kg) + real freight/fabric tables to seed the masters. *(Biggest unblock for the team to start Phase 0.)*

These are not blockers for Phase 0 (masters) or Phase 1 (Multiply-with-Breaker). They can be answered as those belt types come up.
