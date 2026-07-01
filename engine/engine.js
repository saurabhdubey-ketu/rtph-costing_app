// engine/engine.js
// Pure function — no DOM access, no localStorage. Input JSON → output JSON.
// All rates resolved from masters inside here; no hardcoded numbers.

import { effectiveWidth }       from './effective_width.js';
import { effectiveLength }      from './effective_length.js';
import { coverWeight }          from './cover_weight.js';
import { fabricWeight }         from './fabric_weight.js';
import { skimWeight }           from './skim_weight.js';
import { breakerFabricWeight, breakerSkimWeight } from './breaker_weight.js';
import { componentCost, costOfProduction, packingCost, freightCost } from './component_costs.js';
import { materialCostTotal, totalBeltCost, rmcPerMeter } from './rmc.js';
import { cdPricePerMeter, vdPricePerMeter, finalPricePerMeter } from './pricing.js';

import { BELT_TYPE_MASTER }         from '../masters/belt_type_master.js';
import { FABRIC_STRENGTH_MASTER }   from '../masters/fabric_strength_master.js';
import { FABRIC_RATE_MASTER }       from '../masters/fabric_rate_master.js';
import { FABRIC_TYPE_MASTER }       from '../masters/fabric_type_master.js';
import { COVER_SKIM_COMPATIBILITY } from '../masters/compound_master.js';
import { GP_MASTER }                from '../masters/gp_master.js';
// Editable masters — read from live store so admin price changes take effect immediately
import {
  getLiveCompounds, getLiveBreakers, getLivePacking,
  getLiveFreight,   getLiveEdges,
} from '../lib/master_store.js';

function mustFind(arr, predicate, label) {
  const row = arr.find(predicate);
  if (!row) throw new Error(`Master lookup failed: ${label}`);
  return row;
}

/**
 * Run the costing engine for one QuotationLine.
 * @param {object} line - QuotationLine input.
 * @param {object} [overrides] - Optional overrides { sg_top, sg_bottom, cover_rate_top, cover_rate_bottom, tbt }
 * @returns {object} PricedQuotationLine.
 */
export function runEngine(line, overrides = {}) {
  const warnings = [];

  // ── 0. Live masters (merges frozen seed + admin localStorage overrides) ─────
  const COMPOUND_MASTER     = getLiveCompounds();
  const BREAKER_MASTER      = getLiveBreakers();
  const REEL_PACKING_MASTER = getLivePacking();
  const FREIGHT_STATE_MASTER = getLiveFreight();
  const EDGE_MASTER         = getLiveEdges();

  // ── 1. Resolve masters ─────────────────────────────────────────────────────
  const beltType = mustFind(BELT_TYPE_MASTER, r => r.id === line.belt_type_id, `belt_type_id=${line.belt_type_id}`);

  // Width: stored as numeric mm on line (set by form combobox)
  const width_mm = Number(line.width_mm);
  if (!width_mm) throw new Error(`Invalid width — width_mm not set (width_id=${line.width_id})`);

  const edgeRow = mustFind(EDGE_MASTER, r => r.id === line.edge_id, `edge_id=${line.edge_id}`);

  const fabricRow = mustFind(
    FABRIC_STRENGTH_MASTER,
    r => r.fabric_type === line.fabric_type &&
         r.total_strength === line.fabric_strength &&
         r.no_of_ply === line.plies,
    `fabric ${line.fabric_type}-${line.fabric_strength}/${line.plies}`,
  );

  // Fabric GSM and price from FABRIC_RATE_MASTER (grades first, type_defaults as fallback)
  // Uses nearest-match on per_ply_rating so fractional ratings like EE-630/4 (157.5 kN/m)
  // resolve to the closest band (EE-160) instead of silently zeroing out fabric weight.
  const _fabricRateCandidates = FABRIC_RATE_MASTER.grades.filter(
    r => r.fabric_type === line.fabric_type && r.active !== false,
  );
  const _fabricRateExact = _fabricRateCandidates.find(
    r => r.per_ply_rating === fabricRow.per_ply_rating,
  );
  const fabricRateGrade = _fabricRateExact ?? (
    _fabricRateCandidates.length > 0
      ? _fabricRateCandidates.reduce((best, r) =>
          Math.abs(r.per_ply_rating - fabricRow.per_ply_rating) <
          Math.abs(best.per_ply_rating - fabricRow.per_ply_rating) ? r : best
        )
      : null
  );
  if (!_fabricRateExact && fabricRateGrade) {
    warnings.push(
      `Fabric rate: no exact match for ${line.fabric_type} ${fabricRow.per_ply_rating} kN/m/ply — ` +
      `using nearest band ${line.fabric_type}-${fabricRateGrade.per_ply_rating} (GSM ${fabricRateGrade.gsm}). ` +
      `Add exact entry to fabric_rate_master or enter GSM override to suppress this warning.`
    );
  }

  const fabricDefault = FABRIC_RATE_MASTER.type_defaults.find(r => r.fabric_type === line.fabric_type);
  const fabric_gsm_master   = fabricRateGrade?.gsm ?? null;
  const fabric_price_per_kg = fabricRateGrade?.price_per_kg ?? fabricDefault?.default_rate_per_kg ?? 0;

  if (fabric_gsm_master == null && !(overrides.fabric_gsm > 0)) {
    warnings.push(`GSM not found for ${line.fabric_type} per_ply_rating=${fabricRow.per_ply_rating}. Fabric weight will be 0 — add grade to fabric_rate_master or enter GSM manually.`);
  }

  const topCmpd  = mustFind(COMPOUND_MASTER, r => r.id === line.top_cover_compound_id,    `top_cover_compound_id=${line.top_cover_compound_id}`);
  const botCmpd  = mustFind(COMPOUND_MASTER, r => r.id === line.bottom_cover_compound_id, `bottom_cover_compound_id=${line.bottom_cover_compound_id}`);
  const skimCmpd = mustFind(COMPOUND_MASTER, r => r.id === line.skim_compound_id,         `skim_compound_id=${line.skim_compound_id}`);

  const packingRow = mustFind(REEL_PACKING_MASTER, r => r.id === line.reel_packing_id, `reel_packing_id=${line.reel_packing_id}`);
  // Reel type is optional — distinct from packing/crating. Costed separately when present.
  const reelRow = line.reel_type_id
    ? mustFind(REEL_PACKING_MASTER, r => r.id === line.reel_type_id, `reel_type_id=${line.reel_type_id}`)
    : null;

  // Freight — optional (freight_included = false skips freight cost).
  // Destination is also optional — a manually-entered freight_cost_override works without one.
  const freightIncluded = line.freight_included !== false && line.freight_included !== 'no';
  const freightRow = (freightIncluded && line.freight_id)
    ? mustFind(FREIGHT_STATE_MASTER, r => r.id === line.freight_id, `freight_id=${line.freight_id}`)
    : null;
  if (freightIncluded && freightRow?.rate_status === 'pending') {
    warnings.push(`Freight rate for "${freightRow.state_name}" is PENDING — freight cost is ₹0. Confirm rate before sending.`);
  }

  // GP% — accept direct percentage (e.g. 35) or band id
  let gp_pct;
  if (line.gp_pct_direct != null) {
    gp_pct = Number(line.gp_pct_direct) / 100;
  } else {
    const gpBand = mustFind(GP_MASTER.bands, r => r.id === line.gp_band_id, `gp_band_id=${line.gp_band_id}`);
    gp_pct = gpBand.gp_pct;
  }

  // Override resolution — override replaces master rate when set
  const sg_top         = overrides.sg_top             ?? topCmpd.sg;
  const sg_bottom      = overrides.sg_bottom           ?? botCmpd.sg;
  const rate_top       = overrides.cover_rate_top      ?? topCmpd.price_per_kg;
  const rate_bottom    = overrides.cover_rate_bottom   ?? botCmpd.price_per_kg;
  const rate_skim      = overrides.skim_rate            ?? skimCmpd.price_per_kg;
  const eff_fabric_price = overrides.fabric_price      ?? fabric_price_per_kg;
  const eff_fabric_gsm = (overrides.fabric_gsm > 0) ? overrides.fabric_gsm : fabric_gsm_master;
  const extra_cop      = overrides.expenses_per_kg     ?? GP_MASTER.expenses_per_kg_default ?? 0;
  const eff_carcass_mm = overrides.carcass_thickness_mm ?? fabricRow.nominal_carcass_thickness_mm;

  // ── 2. Effective width and length ──────────────────────────────────────────
  // Width: cut-edge gets a fixed +30 mm; moulded/vulcanised have no cutting waste.
  // Length: wastage % is per fabric type (NN=4%, EP/EE/EN=3%, PP=5%);
  //         falls back to belt-type open_end_wastage_pct when fabric type has no value.
  const fabricTypeRow         = FABRIC_TYPE_MASTER.find(r => r.code === line.fabric_type);
  const w_eff                 = effectiveWidth(width_mm, edgeRow.width_wastage_mm ?? 0);
  const total_length_m        = line.length_per_roll_m * line.no_of_rolls;
  const length_wastage_pct    = fabricTypeRow?.length_wastage_pct ?? beltType.open_end_wastage_pct;
  const l_eff                 = effectiveLength(total_length_m, beltType.length_rule, length_wastage_pct, beltType.splice_allowance_m);

  // ── 3. Component weights ───────────────────────────────────────────────────
  const top_cover_weight = coverWeight(w_eff, line.top_cover_thickness_mm, sg_top,    l_eff);
  const bot_cover_weight = coverWeight(w_eff, line.bottom_cover_thickness_mm, sg_bottom, l_eff);
  const { weight_kg: fabric_wt, per_ply_weight_kg, per_ply_length_m } = fabricWeight(w_eff, eff_fabric_gsm ?? 0, l_eff, fabricRow.no_of_ply);

  const { skim_weight_kg, belt_wt_without_breaker_kg, negative: skimNegative } = skimWeight(
    w_eff,
    eff_carcass_mm,
    line.top_cover_thickness_mm,
    line.bottom_cover_thickness_mm,
    sg_top,
    l_eff,
    top_cover_weight,
    bot_cover_weight,
    fabric_wt,
  );

  if (skimNegative) {
    warnings.push('Skim weight is negative — cover + fabric thickness exceeds carcass sandwich. Check thickness inputs.');
  }

  // Breakers
  let brk_top_fabric_wt = 0, brk_top_skim_wt = 0, brk_top_length_m = 0;
  let brk_bot_fabric_wt = 0, brk_bot_skim_wt = 0, brk_bot_length_m = 0;
  let brkTopRow = null, brkBotRow = null, brkTopSkimCmpd = null, brkBotSkimCmpd = null;

  if (beltType.has_breaker) {
    if (line.breaker_top_id) {
      brkTopRow       = mustFind(BREAKER_MASTER, r => r.id === line.breaker_top_id, `breaker_top_id=${line.breaker_top_id}`);
      brkTopSkimCmpd  = mustFind(COMPOUND_MASTER, r => r.id === line.breaker_top_skim_compound_id, `breaker_top_skim_compound_id`);
      const brkTopPly = line.breaker_top_ply ?? brkTopRow.no_of_ply_default ?? 1;
      const brkTopGsm = overrides.breaker_top_gsm ?? brkTopRow.gsm;
      if (brkTopGsm != null) {
        const bot = breakerFabricWeight(w_eff, brkTopGsm, l_eff, brkTopPly);
        brk_top_fabric_wt = bot.weight_kg;
        brk_top_length_m  = bot.breaker_length_m;
      } else {
        warnings.push(`Breaker "${brkTopRow.code}" has no GSM — breaker weight set to 0. Add GSM to breaker_master or enter manually.`);
      }
      brk_top_skim_wt = breakerSkimWeight(w_eff, brkTopRow.skim_thickness_mm, brkTopSkimCmpd.sg, l_eff);
    }
    if (line.breaker_bot_id) {
      brkBotRow       = mustFind(BREAKER_MASTER, r => r.id === line.breaker_bot_id, `breaker_bot_id=${line.breaker_bot_id}`);
      brkBotSkimCmpd  = mustFind(COMPOUND_MASTER, r => r.id === line.breaker_bot_skim_compound_id, `breaker_bot_skim_compound_id`);
      const brkBotPly = line.breaker_bot_ply ?? brkBotRow.no_of_ply_default ?? 1;
      const brkBotGsm = overrides.breaker_bot_gsm ?? brkBotRow.gsm;
      if (brkBotGsm != null) {
        const bob = breakerFabricWeight(w_eff, brkBotGsm, l_eff, brkBotPly);
        brk_bot_fabric_wt = bob.weight_kg;
        brk_bot_length_m  = bob.breaker_length_m;
      } else {
        warnings.push(`Breaker "${brkBotRow.code}" has no GSM — breaker weight set to 0. Add GSM to breaker_master or enter manually.`);
      }
      brk_bot_skim_wt = breakerSkimWeight(w_eff, brkBotRow.skim_thickness_mm, brkBotSkimCmpd.sg, l_eff);
    }
  }

  const total_belt_weight =
    top_cover_weight + bot_cover_weight + fabric_wt + skim_weight_kg +
    brk_top_fabric_wt + brk_top_skim_wt + brk_bot_fabric_wt + brk_bot_skim_wt;

  // Compound weight = total belt weight − fabric weight (remainder method)
  const compound_weight_total = total_belt_weight - fabric_wt;
  const width_factor_val  = w_eff / (width_mm / 1000);
  const length_factor_val = total_length_m > 0 ? l_eff / total_length_m : 1;

  // Actual belt weight per meter — uses nominal width_mm (not W_eff)
  // Formula: (width_mm × TBT_mm × SG_blended) / 1000
  // SG_blended = thickness-weighted average: (sg_top×top_t + sg_skim×carcass_t + sg_bot×bot_t) / TBT
  const tbt_mm_val   = eff_carcass_mm + line.top_cover_thickness_mm + line.bottom_cover_thickness_mm;
  const sg_skim_val  = skimCmpd.sg;
  const sg_blended   = tbt_mm_val > 0
    ? (sg_top * line.top_cover_thickness_mm + sg_skim_val * eff_carcass_mm + sg_bottom * line.bottom_cover_thickness_mm) / tbt_mm_val
    : 0;
  const actual_wt_per_m_val = (width_mm * tbt_mm_val * sg_blended) / 1000;

  const is_endless = (line.endless_length_m ?? 0) > 0;
  const total_actual_belt_weight_kg = is_endless
    ? (line.endless_length_m + 3) * actual_wt_per_m_val * line.no_of_rolls
    : actual_wt_per_m_val * total_length_m;

  // ── 4. Component costs ─────────────────────────────────────────────────────
  const top_cover_cost   = componentCost(top_cover_weight, rate_top);
  const bot_cover_cost   = componentCost(bot_cover_weight, rate_bottom);
  const per_ply_fabric_cost = componentCost(per_ply_weight_kg, eff_fabric_price);
  const fabric_cost         = per_ply_fabric_cost * fabricRow.no_of_ply;
  const skim_cost        = componentCost(skim_weight_kg, rate_skim);

  if (brkTopRow && brkTopRow.price_per_kg == null) throw new Error(`Breaker "${brkTopRow.code}" has no price_per_kg in BREAKER_MASTER — cannot compute cost.`);
  if (brkBotRow && brkBotRow.price_per_kg == null) throw new Error(`Breaker "${brkBotRow.code}" has no price_per_kg in BREAKER_MASTER — cannot compute cost.`);

  const brk_top_cost     = brkTopRow     ? componentCost(brk_top_fabric_wt, brkTopRow.price_per_kg)      : 0;
  const brk_top_sk_cost  = brkTopSkimCmpd ? componentCost(brk_top_skim_wt,  brkTopSkimCmpd.price_per_kg) : 0;
  const brk_bot_cost     = brkBotRow     ? componentCost(brk_bot_fabric_wt, brkBotRow.price_per_kg)      : 0;
  const brk_bot_sk_cost  = brkBotSkimCmpd ? componentCost(brk_bot_skim_wt,  brkBotSkimCmpd.price_per_kg) : 0;

  const mat_cost = materialCostTotal([
    top_cover_cost, bot_cover_cost, fabric_cost, skim_cost,
    brk_top_cost, brk_top_sk_cost, brk_bot_cost, brk_bot_sk_cost,
  ]);

  // Cost aggregates (can only be computed after all component costs are known)
  const fabric_plus_brk_cost    = fabric_cost + brk_top_cost + brk_top_sk_cost + brk_bot_cost + brk_bot_sk_cost;
  const total_compound_cost_val = top_cover_cost + bot_cover_cost + skim_cost +
    brk_top_cost + brk_top_sk_cost + brk_bot_cost + brk_bot_sk_cost;
  const eff_cop_rate   = line.cop_rate_per_kg ?? beltType.cost_of_production_rate_per_kg ?? 0;
  if (!(eff_cop_rate > 0)) {
    warnings.push(`COP rate is 0 — neither line override nor belt type "${beltType.code}" master has a value. Cost of Production will be ₹0.`);
  }
  const cop            = costOfProduction(eff_cop_rate, total_belt_weight);
  const expenses_cost  = extra_cop * total_belt_weight;
  const packing = packingCost(packingRow.packing_cost_per_meter, total_length_m);
  const reel_cost = reelRow ? packingCost(reelRow.packing_cost_per_meter, total_length_m) : 0;

  const freight_rate      = line.freight_cost_override ?? freightRow?.rate_per_kg ?? 0;
  const freight_cost_type = line.freight_cost_type ?? 'KG';
  const freight = freightIncluded
    ? freightCost(freight_rate, freight_cost_type, total_belt_weight, total_length_m, w_eff, l_eff)
    : 0;

  const total_cost = totalBeltCost(mat_cost, cop, expenses_cost, packing + reel_cost, freight);
  const rmc        = rmcPerMeter(total_cost, total_length_m);
  const wt_per_m   = total_length_m > 0 ? total_belt_weight / total_length_m : 0;

  // ── 5. Pricing ─────────────────────────────────────────────────────────────
  const cd_price = cdPricePerMeter(total_cost, gp_pct, total_length_m);
  const vd_price = vdPricePerMeter(total_cost, mat_cost, gp_pct, total_length_m);
  const discount = line.discount_pct ?? 0;
  const cd_final = finalPricePerMeter(cd_price, discount);
  const vd_final = finalPricePerMeter(vd_price, discount);

  const effective_gp_cd = (cd_price * total_length_m - total_cost) / total_cost;
  if (effective_gp_cd < GP_MASTER.min_gp_pct - 1e-9) {
    warnings.push(`Effective GP% (${(effective_gp_cd * 100).toFixed(1)}%) is below minimum threshold (${(GP_MASTER.min_gp_pct * 100).toFixed(0)}%).`);
  }

  // Skim ↔ Cover match check
  const compatEntry = COVER_SKIM_COMPATIBILITY?.find(c =>
    c.cover_grade_family === topCmpd.grade_family ||
    (c.match_level === 'COMPOUND' && c.cover_compound_id === line.top_cover_compound_id),
  );
  const recommendedSkimCmpd = compatEntry ? COMPOUND_MASTER.find(r => r.id === compatEntry.skim_compound_id) : null;
  if (recommendedSkimCmpd && skimCmpd.id !== recommendedSkimCmpd.id) {
    warnings.push(`Skim "${skimCmpd.code}" may not bond with cover grade "${topCmpd.grade_family}". Recommended: ${recommendedSkimCmpd.code}.`);
  }

  if (line.customer_tbt_mm > 0 && tbt_mm_val > line.customer_tbt_mm) {
    warnings.push(`Calculated TBT (${tbt_mm_val.toFixed(2)} mm) exceeds customer maximum of ${line.customer_tbt_mm} mm.`);
  }

  // ── 6. Rate snapshot ───────────────────────────────────────────────────────
  const snapshot = {
    top_cover:      { id: topCmpd.id,    code: topCmpd.code,    sg: sg_top,    price_per_kg: rate_top    },
    bottom_cover:   { id: botCmpd.id,    code: botCmpd.code,    sg: sg_bottom, price_per_kg: rate_bottom },
    skim:           { id: skimCmpd.id,   code: skimCmpd.code,   sg: skimCmpd.sg, price_per_kg: rate_skim },
    fabric:         { fabric_type: line.fabric_type, gsm: eff_fabric_gsm, price_per_kg: eff_fabric_price },
    breaker_top:    brkTopRow     ? { id: brkTopRow.id,    code: brkTopRow.code,    gsm: overrides.breaker_top_gsm ?? brkTopRow.gsm,    price_per_kg: brkTopRow.price_per_kg }    : null,
    breaker_top_skim: brkTopSkimCmpd ? { id: brkTopSkimCmpd.id, code: brkTopSkimCmpd.code, price_per_kg: brkTopSkimCmpd.price_per_kg } : null,
    breaker_bot:    brkBotRow     ? { id: brkBotRow.id,    code: brkBotRow.code,    gsm: overrides.breaker_bot_gsm ?? brkBotRow.gsm,    price_per_kg: brkBotRow.price_per_kg }    : null,
    breaker_bot_skim: brkBotSkimCmpd ? { id: brkBotSkimCmpd.id, code: brkBotSkimCmpd.code, price_per_kg: brkBotSkimCmpd.price_per_kg } : null,
    edge:           { id: edgeRow.id,    name: edgeRow.name,    width_wastage_mm: edgeRow.width_wastage_mm },
    packing:        { id: packingRow.id, code: packingRow.code, packing_cost_per_meter: packingRow.packing_cost_per_meter },
    reel:           reelRow ? { id: reelRow.id, code: reelRow.code, packing_cost_per_meter: reelRow.packing_cost_per_meter } : null,
    freight:        freightRow
      ? { id: freightRow.id, state_name: freightRow.state_name, rate_per_kg: freight_rate, cost_type: freight_cost_type }
      : (freightIncluded && freight_rate > 0 ? { state_name: 'Manual entry', rate_per_kg: freight_rate, cost_type: freight_cost_type } : null),
    gp_pct,
    cop_rate_per_kg:            line.cop_rate_per_kg,
    eff_cop_rate_per_kg:        eff_cop_rate,
    expenses_per_kg:            extra_cop,
    eff_production_rate_per_kg: eff_cop_rate + extra_cop,
    w_eff_m: w_eff,
  };

  return {
    inputs: { ...line },
    derived: {
      effective_width_m:         w_eff,
      effective_length_m:        l_eff,
      total_length_m,
      fabric_gsm:                eff_fabric_gsm,
      per_ply_length_m,
      per_ply_weight_kg,
      fabric_weight_kg:          fabric_wt,
      top_cover_weight_kg:       top_cover_weight,
      bottom_cover_weight_kg:    bot_cover_weight,
      skim_weight_kg,
      belt_wt_without_breaker_kg,
      breaker_top_length_m:       brk_top_length_m,
      breaker_top_weight_kg:      brk_top_fabric_wt,
      breaker_top_skim_weight_kg: brk_top_skim_wt,
      breaker_bot_length_m:       brk_bot_length_m,
      breaker_bot_weight_kg:      brk_bot_fabric_wt,
      breaker_bot_skim_weight_kg: brk_bot_skim_wt,
      total_belt_weight_kg:      total_belt_weight,
      width_factor:              w_eff / (width_mm / 1000),
      length_factor:             total_length_m > 0 ? l_eff / total_length_m : 1,
      weight_per_meter_kg:       total_length_m > 0 ? total_belt_weight / total_length_m : 0,
      tbt_mm:                    tbt_mm_val,
      sg_blended,
      compound_weight_kg:        compound_weight_total,
      base_fabric_code:          `${line.fabric_type}-${fabricRow.per_ply_rating}`,
      fabric_rating:             fabricRow.per_ply_rating,
      actual_belt_weight_kg:      total_belt_weight / (width_factor_val * length_factor_val),
      actual_weight_per_meter_kg: l_eff > 0 ? total_belt_weight / l_eff : 0,
      total_actual_belt_weight_kg,
      total_actual_weight_kg:     l_eff > 0 ? (total_belt_weight / l_eff) * total_length_m : 0,
      calc_weight_per_meter_kg:   total_length_m > 0 ? total_belt_weight / total_length_m : 0,
      total_calc_weight_kg:       total_belt_weight,
      compound_gsm:              (w_eff * l_eff) > 0 ? compound_weight_total / (w_eff * l_eff) * 1000 : 0,
      compound_price_per_kg:     compound_weight_total > 0 ? total_compound_cost_val / compound_weight_total : 0,
      fabric_thickness_mm:       fabricRateGrade?.thickness_mm ?? null,
      fabric_weight_per_m:       total_length_m > 0 ? fabric_wt / total_length_m : 0,
      top_cover_weight_per_m:    total_length_m > 0 ? top_cover_weight / total_length_m : 0,
      bottom_cover_weight_per_m: total_length_m > 0 ? bot_cover_weight / total_length_m : 0,
      breaker_weight_per_m:      total_length_m > 0 ? (brk_top_fabric_wt + brk_top_skim_wt + brk_bot_fabric_wt + brk_bot_skim_wt) / total_length_m : 0,
      skim_weight_per_m:         total_length_m > 0 ? skim_weight_kg / total_length_m : 0,
      bot_weight_kg:             brk_top_fabric_wt + brk_top_skim_wt,
      bob_weight_kg:             brk_bot_fabric_wt + brk_bot_skim_wt,
      bot_weight_per_m:          total_length_m > 0 ? (brk_top_fabric_wt + brk_top_skim_wt) / total_length_m : 0,
      bob_weight_per_m:          total_length_m > 0 ? (brk_bot_fabric_wt + brk_bot_skim_wt) / total_length_m : 0,
      fabric_compound_weight_kg: top_cover_weight + bot_cover_weight + skim_weight_kg,
      fabric_compound_weight_per_m: total_length_m > 0 ? (top_cover_weight + bot_cover_weight + skim_weight_kg) / total_length_m : 0,
      actual_weight_per_m_blended: actual_wt_per_m_val,
    },
    costs: {
      top_cover_cost,
      bottom_cover_cost:    bot_cover_cost,
      per_ply_fabric_cost,
      fabric_cost,
      skim_cost,
      breaker_top_cost:     brk_top_cost,
      breaker_top_skim_cost: brk_top_sk_cost,
      breaker_bot_cost:     brk_bot_cost,
      breaker_bot_skim_cost: brk_bot_sk_cost,
      material_cost:        mat_cost,
      cost_of_production:   cop,
      expenses_cost,
      packing_cost:         packing,
      reel_cost:            reel_cost,
      reel_cost_per_m:      total_length_m > 0 ? reel_cost / total_length_m : 0,
      freight_cost:         freight,
      total_belt_cost:      total_cost,
      total_compound_cost:          total_compound_cost_val,
      compound_price_per_kg:        compound_weight_total > 0 ? total_compound_cost_val / compound_weight_total : 0,
      fabric_plus_breaker_cost:     fabric_plus_brk_cost,
      fabric_plus_breaker_cost_per_m: total_length_m > 0 ? fabric_plus_brk_cost / total_length_m : 0,
      material_cost_per_m:          total_length_m > 0 ? mat_cost / total_length_m : 0,
      cop_per_m:                    total_length_m > 0 ? cop / total_length_m : 0,
      expenses_per_m:               total_length_m > 0 ? expenses_cost / total_length_m : 0,
      crate_cost_per_m:             total_length_m > 0 ? packing / total_length_m : 0,
      cover_cost_per_m:             total_length_m > 0 ? (top_cover_cost + bot_cover_cost) / total_length_m : 0,
      fabric_cost_per_m:            total_length_m > 0 ? fabric_cost / total_length_m : 0,
      skim_cost_per_m:              total_length_m > 0 ? skim_cost / total_length_m : 0,
      compound_cost_per_m:          total_length_m > 0 ? total_compound_cost_val / total_length_m : 0,
      freight_cost_per_m:           total_length_m > 0 ? freight / total_length_m : 0,
      top_cover_cost_per_m:         total_length_m > 0 ? top_cover_cost / total_length_m : 0,
      bottom_cover_cost_per_m:      total_length_m > 0 ? bot_cover_cost / total_length_m : 0,
      breaker_top_total_cost:       brk_top_cost + brk_top_sk_cost,
      breaker_bot_total_cost:       brk_bot_cost + brk_bot_sk_cost,
      breaker_top_cost_per_m:       total_length_m > 0 ? (brk_top_cost + brk_top_sk_cost) / total_length_m : 0,
      breaker_bot_cost_per_m:       total_length_m > 0 ? (brk_bot_cost + brk_bot_sk_cost) / total_length_m : 0,
      fabric_compound_cost:         top_cover_cost + bot_cover_cost + skim_cost,
      fabric_compound_cost_per_m:   total_length_m > 0 ? (top_cover_cost + bot_cover_cost + skim_cost) / total_length_m : 0,
      actual_material_cost:         width_factor_val * length_factor_val > 0 ? mat_cost / (width_factor_val * length_factor_val) : mat_cost,
      actual_material_cost_per_m:   total_length_m > 0 && width_factor_val * length_factor_val > 0 ? (mat_cost / (width_factor_val * length_factor_val)) / total_length_m : 0,
    },
    pricing: {
      rmc_per_meter:          rmc,
      gp_pct_applied:         gp_pct,
      cd_price_per_meter:     cd_price,
      vd_price_per_meter:     vd_price,
      cd_final_per_meter:     cd_final,
      vd_final_per_meter:     vd_final,
      discount_pct:           discount,
      effective_gp_pct_cd:    effective_gp_cd,
      cd_total:               cd_price * total_length_m,
      vd_total:               vd_price * total_length_m,
      cd_final_total:         cd_final * total_length_m,
      vd_final_total:         vd_final * total_length_m,
      gp_value_cd:            (cd_price * total_length_m) - total_cost,
      gp_value_vd:            (vd_price * total_length_m) - mat_cost,
      material_cost_per_m:    total_length_m > 0 ? mat_cost / total_length_m : 0,
      per_mm_vd_price:        width_mm > 0 ? vd_price / width_mm : 0,
      per_mm_cd_price:        width_mm > 0 ? cd_price / width_mm : 0,
      rmc_with_gp_per_m:      total_length_m > 0 ? mat_cost * (1 + gp_pct) / total_length_m : 0,
      min_quotation_rmc_per_m: total_length_m > 0 ? mat_cost * (1 + GP_MASTER.min_gp_pct) / total_length_m : 0,
      per_mm_running_price_pre_quote: width_mm > 0 && total_length_m > 0 ? mat_cost * (1 + GP_MASTER.min_gp_pct) / total_length_m / width_mm : 0,
      freight_rate_used:      freight_rate,
      rmc_per_kg:             wt_per_m > 0 ? rmc / wt_per_m : 0,
      material_cost_per_m:    total_length_m > 0 ? mat_cost / total_length_m : 0,
      material_cost_per_kg:   wt_per_m > 0 ? (total_length_m > 0 ? mat_cost / total_length_m : 0) / wt_per_m : 0,
      cd_price_per_kg:        wt_per_m > 0 ? cd_price / wt_per_m : 0,
      vd_price_per_kg:        wt_per_m > 0 ? vd_price / wt_per_m : 0,
      crate_cost_total:       packing,
      crate_cost_per_m:       total_length_m > 0 ? packing / total_length_m : 0,
      crate_cost_per_kg:      wt_per_m > 0 && total_length_m > 0 ? (packing / total_length_m) / wt_per_m : 0,
      reel_cost_total:        reel_cost,
      reel_cost_per_m:        total_length_m > 0 ? reel_cost / total_length_m : 0,
      reel_cost_per_kg:       wt_per_m > 0 && total_length_m > 0 ? (reel_cost / total_length_m) / wt_per_m : 0,
      freight_cost_total:     freight,
      freight_cost_per_m:     total_length_m > 0 ? freight / total_length_m : 0,
      freight_cost_per_kg:    wt_per_m > 0 && total_length_m > 0 ? (freight / total_length_m) / wt_per_m : 0,
      total_rmc_cost:         total_cost,
    },
    snapshot,
    warnings,
  };
}
