# Calculation Engine — canonical formulas (bug-fixed)

Date: 2026-05-28
Source: reverse-engineered from the Multiply / Steep Angle / Chevron / Sidewall / Endless sheets, normalised into ONE set of formulas with all audit bugs fixed.

> **Read alongside** `01-audit-findings.md` (the bugs) and `03-belt-type-matrix.md` (which components each belt declares). Every formula here reads from masters — no hardcoded rates, no hardcoded SG, no hardcoded wastage.

---

## The one weight formula that underlies everything

For any **solid rubber layer** (cover, skim, breaker skim, sidewall):

```
layer_weight_kg = W_eff(m) × thickness(mm) × SG × L_eff(m)
```

This works because `thickness(mm) × SG(g/cm³) = kg/m²`, so `× width(m) × length(m) = kg`. Clean and exact.

For any **fabric/woven layer** (carcass fabric, breaker fabric) priced by GSM:

```
fabric_weight_kg = W_eff(m) × (GSM ÷ 1000) × L_eff(m) × no_of_ply
```

(`GSM/1000 = kg/m²`.)

### The two shared inputs

**Effective width** (fixes bug C8 — wastage only for cut edge):
```
W_eff = (width_mm + edge.width_wastage_mm) ÷ 1000
        // Cut-Edge: +30 mm. Moulded/Vulcanised: +0 mm. From Edge master.
```

**Effective length** (fixes bug X2 — one rule, driven by belt type):
```
IF belt_type.length_rule = OPEN_END:
    L_eff = total_length × (1 + open_end_wastage_pct)      // 3%
IF belt_type.length_rule = ENDLESS:
    L_eff = endless_length + splice_allowance_m            // +3 m flat
```
Where `total_length = length_per_roll × no_of_rolls` for open-end, and `endless_length` is the loop length for endless.

---

## Component-by-component (each reads its compound/material from a master)

### 1. Covers (top & bottom — now independently selectable)
```
top_cover_weight    = W_eff × top_thickness_mm    × top_compound.SG    × L_eff
bottom_cover_weight = W_eff × bottom_thickness_mm × bottom_compound.SG × L_eff
top_cover_cost      = top_cover_weight    × top_compound.price_per_kg
bottom_cover_cost   = bottom_cover_weight × bottom_compound.price_per_kg
```
> Rough Top / Wavy Top: just use a larger `top_thickness_mm` (texture = extra cover rubber — per Jitesh).

### 2. Carcass fabric
```
fabric_weight = W_eff × (belt_rating.gsm_per_ply ÷ 1000) × L_eff × belt_rating.no_of_ply
fabric_cost   = fabric_weight × fabric.price_per_kg     // type default or per-fabric override
```

### 3. Carcass skim (remainder method — unchanged logic, master-driven rate)
```
belt_wt_without_breaker = W_eff × (carcass_thk + top_thk + bottom_thk) × cover.SG × L_eff
skim_weight = belt_wt_without_breaker − (top_cover_weight + bottom_cover_weight) − fabric_weight
skim_cost   = skim_weight × skim_compound.price_per_kg   // ← the now-selectable skim
```
> Note: the established method approximates the whole no-breaker sandwich at cover SG, then subtracts cover + fabric; the leftover is skim rubber. Preserved as-is for continuity with your validated numbers.

### 4. Breakers (top and/or bottom — only if belt declares them)
```
breaker_weight      = W_eff × (breaker.gsm ÷ 1000) × L_eff × breaker.no_of_ply
breaker_cost        = breaker_weight × breaker.price_per_kg
breaker_skim_weight = W_eff × breaker.skim_thickness_mm × breaker_skim_compound.SG × L_eff
breaker_skim_cost   = breaker_skim_weight × breaker_skim_compound.price_per_kg
```

### 5. Cleats (Chevron, Steep Angle)
```
no_of_cleats   = L_eff ÷ (cleat_pitch_mm ÷ 1000)
weight_per_cleat = (cleat_width_mm ÷ 1000) × cleat_weight_per_1000mm
cleat_weight   = no_of_cleats × weight_per_cleat × (1 + cleat_wastage_pct)   // 10%
cleat_cost     = cleat_weight × cleat_compound.price_per_kg
```
> Chevron simpler variant: `cleat_weight = cleat_weight_per_meter × L_eff` (profile-based). Fixes bug C3 (use one method, not two parallel rows).

### 6. Sidewalls (Steep Angle, Sidewall)
```
sidewall_length = L_eff × 2                                  // both edges
sidewall_weight = sidewall_length × sidewall_weight_per_m × (1 + sidewall_wastage_pct)  // 10%
sidewall_cost   = sidewall_weight × sidewall_compound.price_per_kg
```

### 7. Blinkers (Steep Angle) — fixes bug C5
```
IF blinkers_enabled:                                         // the Yes/No toggle now actually works
    blinker_weight = blinker_weight_per_piece × no_of_blinkers
    blinker_cost   = blinker_weight × blinker_compound.price_per_kg
ELSE:
    blinker_weight = 0;  blinker_cost = 0
```

### 8. Solution + Hardener (Steep Angle, Sidewall)
```
solution_cleat    = solution_per_cleat × no_of_cleats
solution_sidewall = solution_per_m × sidewall_length × 2
total_solution    = solution_cleat + solution_sidewall
solution_cost     = total_solution × solution.price_per_kg
hardener_weight   = total_solution × hardener_pct            // 10%
hardener_cost     = hardener_weight × hardener.price_per_kg
```

---

## Totals (universal)

```
total_belt_weight = Σ (all declared component weights)
material_cost     = Σ (all declared component costs)         // covers+fabric+skim+breakers+cleat+sidewall+blinker+solution+hardener

cost_of_production = belt_type.cost_of_prod_rate × total_belt_weight
packing_cost       = reel/packing.cost_per_meter × total_length      // ← FIX bug C2: use length, not pieces
freight_cost       = freight_rate × (total_belt_weight | area | length)   // by freight cost_type

total_belt_cost = material_cost + cost_of_production + packing_cost + freight_cost
```

### RMC — Raw Material Cost per meter (fixes bug C1/X1 — always divide by length)
```
RMC_per_meter = total_belt_cost ÷ total_length
```

---

## Pricing ladder (this is where I need your input — see "VD" below)

```
// Standard margin: GP applied on FULL cost
GP_amount        = total_belt_cost × GP_pct
selling_price    = total_belt_cost + GP_amount
sp_per_meter     = selling_price ÷ total_length

// "VD" margin: GP applied on MATERIAL cost only (excludes prod/packing/freight)
GP_VD_amount     = material_cost × GP_pct
selling_price_VD = total_belt_cost + GP_VD_amount
sp_VD_per_meter  = selling_price_VD ÷ total_length

// Final price after discount
final_price      = selling_price_(or VD) × (1 − discount_pct)

// Reverse: sales enters a target price, system shows the implied margin (fixes bug C1)
implied_GP_pct   = (custom_price_per_meter − RMC_per_meter) ÷ RMC_per_meter
```

### Currency (export quotes)
```
price_in_FX = price_in_INR ÷ exchange_rate         // USD or EUR, rate from Currency master
```

---

## Pricing semantics — LOCKED with Jitesh

1. ✅ **VD = GP applied on material cost only** (rubber + fabric + breaker). Production, packing, freight are passed through at cost. The leaner price for competitive situations. (`GP_VD_amount = material_cost × GP_pct`.)
2. ✅ **Quote screen shows Standard AND VD side by side** — the salesperson chooses which to send. Then the line-item **discount** is applied, and the **post-discount final price is the headline number that matters** to the customer. So the flow is: compute both → sales picks Standard or VD → apply discount → Final Price (total + per-meter) is the deliverable.
3. ✅ **No rounding** — show the exact calculated rate. (Remove the dealer sheet's `MROUND(...,5)`.)
4. ✅ **Freight** applies to weight by default; switches to per-SQMTR or per-RM only when the freight cost_type says so (matches dealer sheet behaviour).

## Still-open guards (low priority)
- **Negative skim guard** — if cover+fabric ever exceed the no-breaker weight, skim goes negative. Recommend: **warn** (don't silently clamp) — it usually signals a wrong thickness input. Confirm at build time.
