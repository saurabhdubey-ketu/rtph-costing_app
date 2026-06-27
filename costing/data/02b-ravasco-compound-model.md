# How Ravasco Already Models Compounds — and Why It Changes the Costing Master

Date: 2026-05-28
Source: `packages/db/prisma/schema.prisma` + `docs/roadmap.md` of the Ravasco Formulations App (the app Jitesh is already building).

> **Purpose of this document:** Before designing the costing app's "Compound Master," we read how the Ravasco app *actually* defines a compound. The costing app must speak the same language so that integration later is a non-event, not a migration project. This is the single source of truth the belt costing system should ultimately consume.

---

## The big realisation

**In Ravasco, a compound's price-per-kg is NOT typed in. It is COMPUTED from the recipe.**

The chain of truth is:

```
Raw material price (from Purchase Orders / inward register)
        │
        ▼
Recipe: how many "phr" (parts per hundred rubber) of each raw material, across mixing stages
        │
        ▼   cost/kg  =  Σ(phr × RM price) ÷ Σ(phr)        ← Ravasco Phase 6 costing engine
        ▼
Compound cost ₹/kg  +  Specific Gravity (a measured property)
        │
        ▼
Belt layer cost (cover, skim, breaker skim, sidewall, cleat …)   ← THE COSTING APP
        │
        ▼
Belt RMC → GP → Quotation
```

Today your belt Excel **types in** ₹80, ₹65, ₹400 etc. as the compound rates. The moment Ravasco is the source, those numbers come *alive* — change an SBR price on a PO, and every compound that uses SBR re-prices, and therefore every belt quote re-prices. That is the "single source of truth" you've wanted for 3 years.

---

## What a "compound" is in Ravasco (the real schema)

| Ravasco model | What it holds | Relevance to costing |
|---|---|---|
| `Compound` | `code` (e.g. `FR-001`), `name` (e.g. "FR SAR -SIDE WALL"), chemical `category` (FR/HR/SAR…), `standardReference` (IS 1891 M24…), `lifecycleState` | The identity of the compound. Costing picks compounds by code/name. |
| `CompoundVersion` | A **versioned recipe**. Holds `status` (DRAFT→APPROVED→SUPERSEDED) and **`cachedCostPerKg`** + `costComputedAt` | ⭐ This `cachedCostPerKg` is the ₹/kg the costing app reads. Only **APPROVED** versions are valid for costing. |
| `CompoundStage` | A mixing stage (Banbury, Open Mill…) with temps, RPM, fill factor | Not needed for costing (production detail). |
| `StageIngredient` | `phr` of each `RawMaterial` in a stage | The recipe rows that produce the cost. Not needed directly by costing — the *result* (`cachedCostPerKg`) is. |
| `Property` + `PropertyTarget`/`PropertyTest` | Physical properties incl. **`G_PER_CM3` = specific gravity** | ⭐ The SG the costing app needs for weight calc is a *measured property* here, not a typed field. |
| `CompoundRoleDef` | Managed list of **roles a compound plays in a product**: `TOP_COVER`, `SKIM_FABRIC`, `CUSHION`, and admin-extendable `SIDEWALL`, `CLEAT`, `BREAKER_FABRIC_SKIM` | ⭐⭐ This is EXACTLY the "category/type" field I drafted for the costing master. We should reuse these role codes verbatim. |
| `CompoundApplication` | Join table: one compound ↔ **many** (product sub-category, role) pairs, with `isPrimary` | ⭐⭐ This is the **cross-use mechanism** Jitesh asked for — a compound can natively declare multiple roles. No hack needed. |
| `ProductCategory` → `ProductSubCategory` | `CB` (Conveyor Belt) → `TEXTILE`, `STEEL_CORD` … | The belt types live under here. The costing app's belt types should map to these sub-categories. |

### Key facts that drive the design

1. **Cost is computed, never typed** (roadmap Phase 6): `cost/kg = Σ(phr × RM price) ÷ Σ(phr)`. Recomputed within 5 s of any RM price change.
2. **SG is a property, not a field** — it's the `G_PER_CM3` property on the approved version.
3. **A compound declares the roles it can play** via `CompoundApplication`. Picking it for a role it *doesn't* declare is the "cross-use" case → that's where the costing app shows the warning Jitesh wants.
4. **Only APPROVED versions count.** A compound in DRAFT/UNDER_TRIAL should not silently feed a customer quote.
5. **Chemical category (FR/HR/SAR…) ≠ role (cover/skim…).** Ravasco separates them. The costing app cares about **role**; it can display chemical category for context.

---

## Therefore: the costing app's Compound Master is a *lens*, not a new database

The costing app should NOT invent its own compound categories. It should mirror Ravasco's vocabulary so the two converge:

### Before integration (costing app standalone, built by the team now)
A local `costing_compound` table that is a **simplified mirror** of a Ravasco compound:

| Field | Source while standalone | After Ravasco integration |
|---|---|---|
| `code` | typed by admin (e.g. `M-24`) | = Ravasco `Compound.code` |
| `name` | typed | = Ravasco `Compound.name` |
| `roles[]` (one or many) | chosen from the **same role codes** as Ravasco `CompoundRoleDef` | = Ravasco `CompoundApplication` roles |
| `specific_gravity` | typed by admin | = Ravasco `G_PER_CM3` property on approved version |
| `price_per_kg` | typed by admin | = Ravasco `CompoundVersion.cachedCostPerKg` (computed, read-only) |
| `price_source` | `MANUAL` | `RAVASCO_COMPUTED` |
| `ravasco_compound_id` | `null` | the linked Ravasco compound id |

### After integration
- `price_per_kg` and `specific_gravity` stop being editable in the costing app — they're pulled live from Ravasco's approved version.
- An admin "links" each local compound to a Ravasco compound once; thereafter prices flow automatically.
- The costing app still keeps the **quote snapshot** (price frozen at quote time) — that never changes.

This means: **the team can build the costing app now with a manual compound master, and the field shapes are pre-aligned so integration is just "fill these two fields from Ravasco instead of from a human."**

---

## Two flexibility gains this unlocks (parallel to the skim-compound ask)

1. **Skim compound becomes selectable** (the original ask) — because skim is just a role (`SKIM_FABRIC`), and any compound declaring that role appears in the dropdown.

2. **Top cover and bottom cover can be different compounds.** Today the Excel forces ONE grade (B14) for both covers. Ravasco already separates `TOP_COVER` and `BOTTOM_COVER` as distinct roles. The costing app should let the user pick a different compound for each — many real belts use a cheaper bottom cover. (Confirm with Jitesh — see open questions.)

---

## Open questions for Jitesh

1. **Top vs bottom cover** — should the software allow a *different* compound for top vs bottom cover? (Excel currently forces them equal.)
2. **Solution & Hardener** — in Ravasco are these (a) compounds with their own recipe, (b) raw materials/consumables, or (c) bought-in chemicals? The costing app only needs a ₹/kg either way, but the link target differs.
3. **Role list confirmation** — is the merged role list below complete? Any Ravasco roles already seeded we should match exactly?
4. **Standalone seed** — for the team to start now, we need ~10–15 real compounds (code, role, SG, ₹/kg). Can you export these from your current sheets or from Ravasco's compound data if any exists yet?
