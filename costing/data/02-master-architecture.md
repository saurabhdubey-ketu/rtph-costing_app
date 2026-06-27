# Master Architecture — DRAFT

Date: 2026-05-28
Status: DRAFT v0.1 — under discussion with Jitesh.

This document defines every master (reference table) the belt costing software needs, what fields each row holds, and which masters link to which other masters.

> **Design principle:** Every number that drives a price comes from a master row. Formulas never contain hardcoded values. When a master row's price changes, in-flight quotations freeze at the old rate (Quote Snapshot pattern); future quotations use the new rate.

---

## Master inventory (the full list)

| # | Master | Purpose | Primary link |
|---|---|---|---|
| 1 | **Compound** | Price/kg + SG of every rubber compound, skim, sidewall, cleat, blinker, solution, hardener | Used everywhere a "Price / KG" appears |
| 2 | **Fabric (Carcass Reinforcement)** | Price/kg + GSM + thickness per ply per fabric rating | Cover layer of the belt below the compounds |
| 3 | **Fabric Supplier** | Who makes which fabrics, at which plant, with what codes | Owns Fabric rows |
| 4 | **Breaker Fabric / Steel** | Same as Fabric but specifically for breaker layers | Cover layer above carcass |
| 5 | **Belt Type** | The 14 belt types — declares which components each type uses, which wastage rules apply | Drives the calculation engine |
| 6 | **Edge Type** | Cut-Edge, Moulded, Vulcanised, etc. + width-wastage rule per edge | Used in width-wastage formula |
| 7 | **Reel Type / Packing Type** | Circular, Cassette, Single Roll, etc. + price per meter for packing | Used in packing cost |
| 8 | **Freight Zone** | State or city → freight rate per kg/RM/sqmtr | Used in freight cost |
| 9 | **Cost-of-Production rate** | Plant-specific or belt-type-specific labor/overhead rate ₹/kg | Used in cost of production |
| 10 | **Belt Rating** | Convention like "EP-1000/5+2" → maps to underlying fabric rating + cover ply | UX shortcut for selecting fabric configuration |
| 11 | **Customer** | Who we quote to. Defaults: GP%, currency, destination, discount tier | Used in quotation header |
| 12 | **Currency / Exchange Rate** | INR (default), USD, EUR + rate against INR | Used for international quotes |
| 13 | **GP / Discount tier** | Default GP% by customer category or product line | Used in pricing |

---

## 1. Compound Master  ⭐ (the core) — Ravasco-aligned

> See `02b-ravasco-compound-model.md` for the full study of how Ravasco defines compounds. Summary: in Ravasco a compound's **price/kg is computed from its recipe** (`Σ(phr × RM price) ÷ Σ(phr)`) and its **SG is a measured property** (`G_PER_CM3`). The costing app mirrors Ravasco's vocabulary so integration is a non-event. Until integration, price + SG are entered manually; afterward they flow live from Ravasco's approved compound version.

This is the single most important master. Every "Price / KG" cell in the existing Excel becomes a lookup against a row here.

### Roles (NOT "categories") — mirror Ravasco's `CompoundRoleDef`

A compound declares **one or more roles** it can play in a belt — exactly as Ravasco's `CompoundApplication` lets one compound map to many roles. The role controls which dropdown it appears in.

Default dropdown behaviour (this is the skim-compound ask + cross-use, solved natively):
- Filling the *Skim (Fabric)* slot → dropdown shows only compounds whose `roles[]` includes `SKIM_FABRIC`.
- "Show all compounds" link reveals compounds that do **not** declare this role.
- Picking one of those → yellow banner: *"M-24 is normally a Top Cover compound. You're using it as Fabric Skim. Confirm this is intentional."* and the choice is logged on the quote.

> **Note on chemical category vs role.** Ravasco *also* has a chemical `category` (FR = Fire Resistant, HR = Heat Resistant, SAR = Super Abrasion Resistant, M24…). That is *what the compound is*, not *what slot it fills*. The costing app stores it for display/filtering but it does not drive cost. **Role** is what drives the dropdowns.

**Merged role list** (matches Ravasco's `CONSTANT_CASE` codes; admin-extendable):

| Role code | Label | Where used in belts | SG range | Typical ₹/kg |
|---|---|---|---|---|
| `TOP_COVER` | Top Cover | Top wear surface | ~1.10–1.20 | 80–150 |
| `BOTTOM_COVER` | Bottom Cover | Pulley-side cover (**can now differ from top** — locked with Jitesh) | ~1.10–1.20 | 80–150 |
| `SKIM` | Skim | **ONE skim list** (per Jitesh — not split fabric/breaker). Each skim carries `skim_for` = Fabric and/or Steel Breaker, and matches covers by grade family. See `02c`. | ~1.18–1.25 | 65–90 |
| `CUSHION` | Cushion | Optional layer between carcass and cover | ~1.18 | varies |
| `SIDEWALL` | Sidewall | Steep Angle, Sidewall belts | ~1.25 | 150 |
| `CLEAT` | Cleat | Steep Angle, Chevron belts | ~1.12–1.18 | 150 |
| `BLINKER` | Blinker | Steep Angle only | ~1.18 | 150 |
| `SOLUTION` | Bonding Solution / Cement | Bonding cleat/sidewall to belt. Made in-house OR bought (`price_source` handles both). | ~0.85 | 1000 |
| `HARDENER` | Hardener | Vulcanising agent for solution. Always bought-out (`price_source = MANUAL`). | — | 750 |
| `EDGE` | Edge Strip | Sealing cut edges (optional) | ~1.18 | varies |

> **Cover compounds additionally carry `grade_family`** (`GP / AR / HR / FR / OR / COLD / LRR`) and optional `polymer_base`. **Skim ↔ Cover matching** is governed by the `cover_skim_compatibility` table — full design in `02c-indus-grades-and-skim-matching.md`. This is the engineering rule that a skim must chemically bond with its cover.

### Fields per compound row

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `code` | text, unique | ✓ | `M-24` | Mirrors Ravasco `Compound.code`. The short identifier everyone says aloud. |
| `name` | text | ✓ | `M-24 General Purpose Cover` | Mirrors Ravasco `Compound.name`. |
| `roles` | multi-select (role codes above) | ✓ | `[TOP_COVER, BOTTOM_COVER]` | One or many. Mirrors Ravasco `CompoundApplication`. Drives dropdown filtering. |
| `chemical_category` | dropdown | — | `M24` / `FR` / `HR` | Mirrors Ravasco `CompoundCategoryDef`. Display/filter only; does not drive cost. |
| `specific_gravity` | decimal(5,3) | ✓ | `1.180` | g/cm³. From Ravasco `G_PER_CM3` property after integration; typed before. |
| `price_per_kg` | decimal(14,4), INR | ✓ | `123.0000` | From Ravasco `cachedCostPerKg` after integration; typed before. (Decimal(14,4) matches Ravasco's money convention.) |
| `price_source` | enum | ✓ | `MANUAL` | `MANUAL` (standalone) / `RAVASCO_COMPUTED` (after link). When RAVASCO_COMPUTED, price + SG are read-only. |
| `effective_from` | date | ✓ | `2026-04-01` | When this price came into effect. |
| `status` | enum | ✓ | `Active` | Active / Archived. Archived can't be picked for new quotes; past quotes still see it. Mirrors Ravasco `lifecycleState` (only APPROVED-equivalent is pickable). |
| `notes` | text | — | "Lower SG variant for export" | Free-form. |
| `ravasco_compound_id` | FK (nullable) | — | `null` | Link to Ravasco `Compound` when integration ships. Until then null. |
| `created_by`, `created_at`, `updated_by`, `updated_at` | audit | ✓ | system-filled | |

### Cover grade spec fields (full spec per grade — locked with Jitesh)

Cover compounds (and any grade we publish) additionally store the published spec, used for datasheets/quotes and to inform skim matching. All optional except where a belt standard requires them:

| Field | Type | Example (IS-M-24) | Notes |
|---|---|---|---|
| `grade_family` | enum | `GP` | GP/AR/HR/FR/OR/COLD/LRR — drives skim matching. |
| `polymer_base` | text | `NR/SBR` | e.g. SBR, EPDM, NBR, CR. Informs hard compatibility cases. |
| `tensile_strength_mpa` | decimal | `24` | Min tensile. |
| `elongation_pct` | decimal | `450` | Min elongation at break. |
| `abrasion_loss_mm3` | decimal | `150` | Max abrasion loss (lower = better wear). |
| `max_temp_c` | int | `—` | For HR grades: e.g. HR=125, SHR=150, UHR=200, SUHR=250. |
| `standard_refs` | multi-text | `IS 1891`, `ISO 14890 H`, `DIN X` | Links to standards (mirrors Ravasco `StandardReference`). |
| `brand_line` | text | `Super Brute` | Indus product line for marketing/datasheet. |

These do not affect cost math (cost = SG × thickness × price); they drive the printed datasheet and the skim-recommendation engine.

### Price history (separate table, automatic)

Every time `current_price_per_kg` is edited, the old value is written to a `compound_price_history` row:

| Field | Example |
|---|---|
| `compound_id` | M-24 |
| `price_per_kg` | 118.00 |
| `effective_from` | 2025-09-01 |
| `effective_to` | 2026-04-01 |
| `changed_by` | jitesh@ravasco.com |
| `change_reason` | "Annual price update — raw materials up 4%" |

Quotations issued between effective_from and effective_to of an old row "snapshot" that old price. (See Quote Snapshot below.)

### Quote snapshot rule

When a quotation is *saved*, the system writes a per-quote copy of every compound row used: code, SG, price/kg at that moment, category. These snapshot values are what the quote shows forever. Even if the master row is later changed or deleted, the quote's numbers are intact.

This is the same pattern used in invoicing — old invoices don't update when product prices change.

### Example: how the current Multiply belt costing maps to the master

Today's Excel cell → tomorrow's master lookup:

| Today (hardcoded in Excel) | Tomorrow (master lookup) |
|---|---|
| G47 = 80 (Cover ₹/kg) | `lookup(compound, code=M-24).current_price_per_kg` = 80 (or whatever's current) |
| D44 = 1.18 (Cover SG) | `lookup(compound, code=M-24).specific_gravity` = 1.18 |
| G53 = 65 (Fabric Skim ₹/kg) | `lookup(compound, code=<user-selected>).current_price_per_kg` ← **new dropdown** |
| G56 = 400 (Breaker 1 ₹/kg) | This isn't a compound — it's the *breaker fabric* ₹/kg. See Breaker Fabric master below. |
| G59 = 65 (Breaker 1 Skim ₹/kg) | `lookup(compound, code=NN-III).current_price_per_kg` |
| D59 = 1.22 (Breaker 1 Skim SG) | `lookup(compound, code=NN-III).specific_gravity` |
| G65 = 88 (Breaker 2 Skim ₹/kg) | `lookup(compound, code=STBR-III).current_price_per_kg` |

---

## 2. Fabric (Carcass Reinforcement) Master ⭐

The carcass is the load-bearing fabric inside the belt. In your sheets this lives across Sheet0 (cols A–B GSM, AD–AG carcass thickness, W–X price) and the embedded J-column master in File 1. There are three linked levels — getting the grain right is what makes this flexible.

> **Pricing rule (locked with Jitesh): type-level default + per-fabric override.** Level A holds a fallback ₹/kg; a specific Level-B fabric can override it. **Multi-supplier is in scope from v1** — Level-B fabric is keyed by (type, per-ply rating, supplier), and price follows the supplier.

### Level A — Fabric Type
The reinforcement family.

| Field | Example | Notes |
|---|---|---|
| `code` | `EP` | NN, EP, EE, PP, EN, Straight-Warp, Solid-Woven |
| `name` | `Polyester–Polyester (EP)` | |
| `default_price_per_kg` | `265` | Fallback price if a specific fabric has none (Sheet0 W–X). |
| `length_wastage_pct` | `3%` | Fabric cut/length wastage (Sheet0 Y–AA: NN 4%, EP 3%, EE 3%, PP 5%). |
| `ravasco_link` | nullable | Future: link to Ravasco RM if fabrics are tracked there. |

### Level B — Fabric (per-ply, the buyable item) ⭐
This is the actual fabric you purchase: a fabric type at a specific per-ply strength, from a supplier. **This is the grain that prices the carcass.**

| Field | Example | Notes |
|---|---|---|
| `code` | `EP-200-MIT` | type + per-ply rating + supplier short form (matches your J26 "EP-200-MIT"). |
| `fabric_type` | `EP` | → Level A |
| `per_ply_rating` | `200` | N/mm per single ply (EP-200). |
| `supplier_id` | `MIT` | → Fabric Supplier master |
| `gsm` | `660` | Grams/m² (Sheet0 B). Drives fabric weight. |
| `thickness_mm` | `0.95` | Per-ply thickness (embedded J33). |
| `price_per_kg` | `265` | Overrides Level-A default if set. |
| `supplier_material_code` | `EP-200` | Supplier's own code (J23). |
| `internal_material_code` | — | Your code. |
| `status` | `Active` | |

### Level C — Belt Rating (the convenience selector)
The shorthand your team actually says: `EP-1000/5`. Decodes into the plies below.

| Field | Example | Notes |
|---|---|---|
| `code` | `EP-1000/5` | Full belt: type-totalStrength/plyCount. |
| `fabric_type` | `EP` | |
| `total_breaking_strength` | `1000` | N/mm full-belt (Excel B10/K12). |
| `no_of_ply` | `5` | (Excel B11/K21). |
| `per_ply_rating` | `200` | = total ÷ ply (1000/5). Points to the Level-B fabric. |
| `nominal_carcass_thickness_mm` | `6.8` | Total carcass thickness (Sheet0 AG / embedded K27). |
| `inter_ply_thickness_mm` | `0.55` | Skim between plies (K30). |

> When the user picks Belt Rating `EP-1000/5`, the engine knows: 5 plies of fabric `EP-200`, GSM 660, carcass thickness 6.8 mm — all by lookup, nothing typed.

---

## 3. Fabric Supplier Master
Mirror of Ravasco's `Supplier`. From File 1's J/L/M columns (Madura Industrial Textiles = MIT).

| Field | Example |
|---|---|
| `name` | `Madura Industrial Textiles Limited` |
| `short_form` | `MIT` |
| `supplier_code` | `1` |
| `location` | `Dadra Unit` |
| `location_code` | `2` |
| `status` | `Active` |
| `ravasco_supplier_id` | nullable (link later) |

---

## 4. Breaker Master ⭐
A breaker is a reinforcement layer above the carcass (impact protection). From File 1 columns L & M. There can be a Breaker-on-Top and a Breaker-on-Bottom, each with its own skim (now selected from the SKIM compound list).

| Field | Example | Notes |
|---|---|---|
| `code` | `MCO-16-MIT` | (embedded L26). |
| `breaker_type` | `Regular Fabric Breaker` | Types seen: Regular Fabric Breaker, Steel Breaker, Cross Rigid Fabric, Cord Breaker. |
| `supplier_id` | `MIT` | → supplier master |
| `gsm` | `140` | (L30). |
| `thickness_mm` | `0.3` | (L33). |
| `no_of_ply` | `1` | |
| `price_per_kg` | `400` | Was hardcoded G56. |
| `supplier_material_code` | `MCO16` | (L23). |
| `default_skim_compound` | → SKIM compound | The breaker's matching skim (still user-selectable, recommended-first). |
| `status` | `Active` | |

---

## 5. Edge Type Master (drives width-wastage — fixes bug C8/S3)

| Field | Example | Notes |
|---|---|---|
| `code` | `CUT_EDGE` | Cut-Edge, Moulded, Vulcanised, Sealed |
| `name` | `Cut Edge` | |
| `width_wastage_mm` | `30` | **Cut-Edge = 30, Moulded = 0.** This parametrises the bug we're fixing. |
| `status` | `Active` | |

---

## 6. Reel Type / Packing Type Master

| Field | Example | Notes |
|---|---|---|
| `code` | `CIRCULAR` | Circular, Cassette, Single Roll, Swing Roll, Steel Crate, HDPE |
| `name` | `Circular Reel` | |
| `packing_cost_per_meter` | `4` | Was hardcoded B33/B49. |
| `applies_to` | `reel` / `packing` | Some are reel types, some packing types. |
| `status` | `Active` | |

---

## 7. Freight Zone Master (state/city → rate)
From Sheet0 cols AJ–AL. Fixes the silent-zero bug (C/S5).

| Field | Example | Notes |
|---|---|---|
| `state` | `Bihar` | |
| `state_code` | `BR` | |
| `city` | `Jamshedpur` | Optional finer grain. |
| `freight_rate` | `9.89` | Per the cost-type unit below. |
| `cost_type` | `KG` | KG / SQMTR / RM (running meter) — from Sheet0 M & belt AI. |
| `status` | `Active` | |

---

## 8. Cost-of-Production Master  (scope = BELT_TYPE — locked with Jitesh)
Was hardcoded per sheet (₹22–30/kg). Confirmed: **rate varies by belt type.**

| Field | Example | Notes |
|---|---|---|
| `belt_type_id` | `MULTIPLY_BREAKER` | The rate is keyed to the belt type. |
| `rate_per_kg` | `22` | Multiply ≈ 22, Steep Angle ≈ 30, etc. |
| `effective_from` | date | History kept on change (like compound prices). |
| `status` | `Active` | |

> Plant-level variation can be added later by extending the key to (belt_type, plant); not needed for v1.

---

## 9. Belt Type Master
The 14 types — declares which components each uses + wastage rules. Full design in `03-belt-type-matrix.md`. Key fields preview:

| Field | Example |
|---|---|
| `code` | `MULTIPLY_BREAKER` |
| `name` | `Multi-Ply Textile Conveyor Belt with Breaker` |
| `components[]` | `[TOP_COVER, BOTTOM_COVER, FABRIC, SKIM, BREAKER_TOP, BREAKER_TOP_SKIM, BREAKER_BOTTOM, BREAKER_BOTTOM_SKIM]` |
| `length_wastage_rule` | `OPEN_END_3PCT` / `ENDLESS_SPLICE_3M` |
| `maps_to_ravasco_subcategory` | `CB → TEXTILE` |

---

## 10–13. Smaller masters (brief)

- **Customer** — name, GST, default destination (→ freight), default GP%, default currency, discount tier. Used in quote header.
- **Currency / Exchange Rate** — INR default; USD/EUR with rate vs INR (Excel CE column). Used for export quotes.
- **GP / Discount tier** — default GP% by customer category or product line.
- **Standard Reference** — IS 1891, ISO 14890, DIN, MSHA… (mirror Ravasco `StandardReference`) for datasheets.

---

*Masters 2–8 carry the same universals as the compound master: `status` (Active/Archived), full audit fields, and the quote-snapshot rule (every value used in a quote is frozen at save time).*
