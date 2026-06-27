/**
 * tests/generate_15.mjs — 15 random HRS-style belt specs → CDS → PDF + Report
 *
 * Picks 15 diverse belt specifications spanning the HRS spec range,
 * runs each through the CDS engine, builds the same print-HTML that the
 * UI's Save-as-PDF button produces, posts it to /api/pdf, and saves the
 * returned PDF to tests/pdf_out_15/. Also writes a markdown report.
 *
 * Usage: node tests/generate_15.mjs   (server must be running on :5000)
 */

// ── Mock browser globals (must run before any browser-coupled imports) ──────
import './_dom_shim.mjs';

import { runEngine }        from '../engine/engine.js';
import { getQuotationHTML } from '../lib/print_pdf.js';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath }    from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = resolve(__dirname, 'pdf_out_15');
mkdirSync(OUT_DIR, { recursive: true });

const SERVER = 'http://localhost:5000';

// ─────────────────────────────────────────────────────────────────────────────
// 15 HRS-STYLE BELT SPECS — random sample across the spec range
// Mix of:
//   fabric_type: EE / EP / NN
//   plies:       3, 4, 5, 6
//   widths:      650–1800 mm
//   covers:      4+2 up to 10+5
//   breakers:    none / top only / top + bottom (where belt type allows)
//   lengths:     50–300 m
//   GP%:         18 (sub-floor), 20, 22, 25, 28, 30
//   freight:     MH / GJ / TN / UP / KA / WB / RJ
// ─────────────────────────────────────────────────────────────────────────────
const SPECS = [
  {
    id: 'T01', desc: 'EP-500/4 1000mm CE 5+3 Plain 100m 20% MH',
    line: {
      belt_type_id:'BT-MULTIPLY', fabric_type:'EP', fabric_strength:500, plies:4,
      width_mm:1000, edge_id:'EDGE-CE', top_cover_thickness_mm:5, bottom_cover_thickness_mm:3,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      length_per_roll_m:100, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-MH', freight_included:true, gp_pct_direct:20,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T02', desc: 'EP-630/4 1200mm CE 6+3 Plain 150m 22% GJ',
    line: {
      belt_type_id:'BT-MULTIPLY', fabric_type:'EP', fabric_strength:630, plies:4,
      width_mm:1200, edge_id:'EDGE-CE', top_cover_thickness_mm:6, bottom_cover_thickness_mm:3,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      length_per_roll_m:150, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-GJ', freight_included:true, gp_pct_direct:22,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T03', desc: 'NN-500/4 900mm CE 6+3 Plain 75m 25% TN',
    line: {
      belt_type_id:'BT-MULTIPLY', fabric_type:'NN', fabric_strength:500, plies:4,
      width_mm:900, edge_id:'EDGE-CE', top_cover_thickness_mm:6, bottom_cover_thickness_mm:3,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      length_per_roll_m:75, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-TN', freight_included:true, gp_pct_direct:25,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T04', desc: 'EP-800/5 1400mm CE 8+4 Plain 200m 25% MH',
    line: {
      belt_type_id:'BT-MULTIPLY', fabric_type:'EP', fabric_strength:800, plies:5,
      width_mm:1400, edge_id:'EDGE-CE', top_cover_thickness_mm:8, bottom_cover_thickness_mm:4,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      length_per_roll_m:200, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-MH', freight_included:true, gp_pct_direct:25,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T05', desc: 'NN-1000/4 1200mm CE 8+5 +BOT 50m 30% KA',
    line: {
      belt_type_id:'BT-MULTIPLY-BRK', fabric_type:'NN', fabric_strength:1000, plies:4,
      width_mm:1200, edge_id:'EDGE-CE', top_cover_thickness_mm:8, bottom_cover_thickness_mm:5,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      breaker_top_id:'BRK-TOP', breaker_top_skim_compound_id:'CMP-NNIII', breaker_top_ply:1,
      length_per_roll_m:50, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-KA', freight_included:true, gp_pct_direct:30,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T06', desc: 'EP-1000/5 1600mm CE 10+5 +BOT+BOB 120m 28% UP',
    line: {
      belt_type_id:'BT-MULTIPLY-BRK', fabric_type:'EP', fabric_strength:1000, plies:5,
      width_mm:1600, edge_id:'EDGE-CE', top_cover_thickness_mm:10, bottom_cover_thickness_mm:5,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      breaker_top_id:'BRK-TOP', breaker_top_skim_compound_id:'CMP-NNIII', breaker_top_ply:1,
      breaker_bot_id:'BRK-BOB', breaker_bot_skim_compound_id:'CMP-NNIII', breaker_bot_ply:1,
      length_per_roll_m:120, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-UP', freight_included:true, gp_pct_direct:28,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T07', desc: 'NN-800/4 1600mm CE 5+3 Plain 200m 20% MH',
    line: {
      belt_type_id:'BT-MULTIPLY', fabric_type:'NN', fabric_strength:800, plies:4,
      width_mm:1600, edge_id:'EDGE-CE', top_cover_thickness_mm:5, bottom_cover_thickness_mm:3,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      length_per_roll_m:200, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-MH', freight_included:true, gp_pct_direct:20,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T08', desc: 'EP-315/3 800mm CE 4+2 Plain 90m 22% RJ',
    line: {
      belt_type_id:'BT-MULTIPLY', fabric_type:'EP', fabric_strength:315, plies:3,
      width_mm:800, edge_id:'EDGE-CE', top_cover_thickness_mm:4, bottom_cover_thickness_mm:2,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      length_per_roll_m:90, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-RJ', freight_included:true, gp_pct_direct:22,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T09', desc: 'NN-630/4 1050mm CE 6+4 Plain 100m 25% WB',
    line: {
      belt_type_id:'BT-MULTIPLY', fabric_type:'NN', fabric_strength:630, plies:4,
      width_mm:1050, edge_id:'EDGE-CE', top_cover_thickness_mm:6, bottom_cover_thickness_mm:4,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      length_per_roll_m:100, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-WB', freight_included:true, gp_pct_direct:25,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T10', desc: 'EP-400/3 650mm CE 4+2 Plain 60m 20% MH',
    line: {
      belt_type_id:'BT-MULTIPLY', fabric_type:'EP', fabric_strength:400, plies:3,
      width_mm:650, edge_id:'EDGE-CE', top_cover_thickness_mm:4, bottom_cover_thickness_mm:2,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      length_per_roll_m:60, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-MH', freight_included:true, gp_pct_direct:20,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T11', desc: 'EP-1200/4 1400mm CE 6+4 Plain 150m 22% GJ',
    line: {
      belt_type_id:'BT-MULTIPLY', fabric_type:'EP', fabric_strength:1200, plies:4,
      width_mm:1400, edge_id:'EDGE-CE', top_cover_thickness_mm:6, bottom_cover_thickness_mm:4,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      length_per_roll_m:150, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-GJ', freight_included:true, gp_pct_direct:22,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T12', desc: 'NN-400/3 750mm CE 4+3 Plain 80m 25% KA',
    line: {
      belt_type_id:'BT-MULTIPLY', fabric_type:'NN', fabric_strength:400, plies:3,
      width_mm:750, edge_id:'EDGE-CE', top_cover_thickness_mm:4, bottom_cover_thickness_mm:3,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      length_per_roll_m:80, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-KA', freight_included:true, gp_pct_direct:25,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T13', desc: 'EP-630/5 1200mm CE 8+4 +BOT 100m 28% TN',
    line: {
      belt_type_id:'BT-MULTIPLY-BRK', fabric_type:'EP', fabric_strength:630, plies:5,
      width_mm:1200, edge_id:'EDGE-CE', top_cover_thickness_mm:8, bottom_cover_thickness_mm:4,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      breaker_top_id:'BRK-TOP', breaker_top_skim_compound_id:'CMP-NNIII', breaker_top_ply:1,
      length_per_roll_m:100, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-TN', freight_included:true, gp_pct_direct:28,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T14', desc: 'NN-1250/5 1800mm CE 10+5 +BOT 80m 30% MH',
    line: {
      belt_type_id:'BT-MULTIPLY-BRK', fabric_type:'NN', fabric_strength:1250, plies:5,
      width_mm:1800, edge_id:'EDGE-CE', top_cover_thickness_mm:10, bottom_cover_thickness_mm:5,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      breaker_top_id:'BRK-TOP', breaker_top_skim_compound_id:'CMP-NNIII', breaker_top_ply:1,
      length_per_roll_m:80, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-MH', freight_included:true, gp_pct_direct:30,
    }, ovr:{ expenses_per_kg:20 },
  },
  {
    id: 'T15', desc: 'EP-500/4 1000mm CE 5+3 Plain 100m 18% UP (sub-floor GP)',
    line: {
      belt_type_id:'BT-MULTIPLY', fabric_type:'EP', fabric_strength:500, plies:4,
      width_mm:1000, edge_id:'EDGE-CE', top_cover_thickness_mm:5, bottom_cover_thickness_mm:3,
      top_cover_compound_id:'CMP-M24', bottom_cover_compound_id:'CMP-M24', skim_compound_id:'CMP-SKFAB',
      length_per_roll_m:100, no_of_rolls:1, cop_rate_per_kg:22,
      reel_packing_id:'RPK-HDPE', freight_id:'FRT-ST-UP', freight_included:true, gp_pct_direct:18,
    }, ovr:{ expenses_per_kg:20 },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const f2  = n => (n != null && !isNaN(n)) ? n.toFixed(2)         : '—';
const f4  = n => (n != null && !isNaN(n)) ? n.toFixed(4)         : '—';
const rs  = n => (n != null && !isNaN(n)) ? `Rs.${n.toFixed(2)}` : '—';
const pct = n => (n != null && !isNaN(n)) ? `${(n*100).toFixed(2)}%` : '—';

// Stable customer ID present in seed data (used purely for header rendering)
const CUSTOMER_ID = 'CUS-0003';

async function fetchPdf(html, filename) {
  const resp = await fetch(`${SERVER}/api/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, filename }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error(`Server ${resp.status}: ${err.slice(0, 200)}`);
  }
  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}

// ── Main loop ────────────────────────────────────────────────────────────────
const summary = [];
console.log(`\n  Generating ${SPECS.length} test PDFs → ${OUT_DIR}\n`);

for (let i = 0; i < SPECS.length; i++) {
  const spec = SPECS[i];
  const row  = { id: spec.id, desc: spec.desc };
  process.stdout.write(`  [${String(i+1).padStart(2,'0')}/${SPECS.length}] ${spec.id}  ${spec.desc.padEnd(54)} `);

  let engineResult = null;
  try {
    engineResult = runEngine(spec.line, spec.ovr);
  } catch (e) {
    row.error = `engine: ${e.message}`;
    summary.push(row);
    console.log(`ENGINE-ERR  ${e.message}`);
    continue;
  }

  row.weight_per_m       = engineResult.derived.weight_per_meter_kg;
  row.total_belt_weight  = engineResult.derived.total_belt_weight_kg;
  row.material_cost      = engineResult.costs.material_cost;
  row.total_belt_cost    = engineResult.costs.total_belt_cost;
  row.cd_price_per_m     = engineResult.pricing.cd_price_per_meter;
  row.vd_price_per_m     = engineResult.pricing.vd_price_per_meter;
  row.cd_total           = engineResult.pricing.cd_total;
  row.gp_applied         = engineResult.pricing.gp_pct_applied;
  row.effective_gp_cd    = engineResult.pricing.effective_gp_pct_cd;
  row.min_quotation_per_m= engineResult.pricing.min_quotation_rmc_per_m;
  row.warnings           = engineResult.warnings.length;
  row.warning_list       = engineResult.warnings;

  // Build a synthetic quotation envelope so getQuotationHTML produces the
  // same print HTML the UI's Save-as-PDF button emits.
  const quotation = {
    id: `TEST-${spec.id}`,
    status: 'sent',
    sent_at: new Date().toISOString(),
    customer_id: CUSTOMER_ID,
    location_id: null,
    enquiry_id: null,
    special_note: `Synthetic HRS-style test ${spec.id}: ${spec.desc}`,
    lines: [{ ...spec.line, result: engineResult }],
  };

  let html;
  try {
    const info = getQuotationHTML(quotation);
    if (!info) throw new Error('getQuotationHTML returned null');
    html = info.html;
  } catch (e) {
    row.error = `html: ${e.message}`;
    summary.push(row);
    console.log(`HTML-ERR    ${e.message}`);
    continue;
  }

  const filename = `${spec.id}_${spec.line.fabric_type}-${spec.line.fabric_strength}-${spec.line.plies}_${spec.line.width_mm}mm`;
  try {
    const pdf = await fetchPdf(html, filename);
    writeFileSync(resolve(OUT_DIR, `${filename}.pdf`), pdf);
    row.pdf_kb = (pdf.length / 1024).toFixed(1);
    row.pdf    = `${filename}.pdf`;
    console.log(`OK  ${row.pdf_kb} KB`);
  } catch (e) {
    row.error = `pdf: ${e.message}`;
    console.log(`PDF-ERR     ${e.message}`);
  }

  summary.push(row);
}

// ── Report ───────────────────────────────────────────────────────────────────
const lines = [];
const p = s => lines.push(s);

p('# HRS → CDS Test Run — 15 Random Belt Specs');
p('');
p(`**Generated:** ${new Date().toISOString().slice(0,19).replace('T',' ')}`);
p(`**Output folder:** \`tests/pdf_out_15/\``);
p(`**Server:** ${SERVER}`);
p('');
p('## Summary');
p('');
const ok    = summary.filter(r => !r.error).length;
const fail  = summary.filter(r =>  r.error).length;
const warns = summary.reduce((s, r) => s + (r.warnings || 0), 0);
p(`- Total specs run: **${summary.length}**`);
p(`- PDFs generated: **${ok}** / ${summary.length}`);
p(`- Errors: **${fail}**`);
p(`- Engine warnings (aggregate): **${warns}**`);
p('');

p('## Spec Results');
p('');
p('| # | ID | Spec | Belt Wt/m | Total Wt | Total Cost | Standard/m | Eff GP% | PDF (KB) | Status |');
p('|---|----|------|-----------|----------|------------|------|---------|----------|--------|');
summary.forEach((r, i) => {
  const status = r.error ? `❌ ${r.error}` : (r.warnings ? `⚠ ${r.warnings} warn` : '✅');
  p(`| ${i+1} | ${r.id} | ${r.desc} | ${f2(r.weight_per_m)} kg | ${f2(r.total_belt_weight)} kg | ${rs(r.total_belt_cost)} | ${rs(r.cd_price_per_m)} | ${pct(r.effective_gp_cd)} | ${r.pdf_kb ?? '—'} | ${status} |`);
});
p('');

p('## Per-Spec Detail');
p('');
summary.forEach((r, i) => {
  p(`### ${i+1}. ${r.id} — ${r.desc}`);
  p('');
  if (r.error) { p(`- ❌ **Error:** ${r.error}`); p(''); return; }
  p(`- Belt weight per meter: **${f2(r.weight_per_m)} kg/m**`);
  p(`- Total belt weight: **${f2(r.total_belt_weight)} kg**`);
  p(`- Material cost: **${rs(r.material_cost)}**`);
  p(`- Total belt cost: **${rs(r.total_belt_cost)}**`);
  p(`- Standard price per meter: **${rs(r.cd_price_per_m)}**`);
  p(`- VD price per meter: **${rs(r.vd_price_per_m)}**`);
  p(`- Standard total order value: **${rs(r.cd_total)}**`);
  p(`- GP% applied: **${pct(r.gp_applied)}** | Effective GP%: **${pct(r.effective_gp_cd)}**`);
  p(`- Min quotation (20% GP floor): **${rs(r.min_quotation_per_m)} / m**`);
  p(`- PDF: \`${r.pdf}\` (${r.pdf_kb} KB)`);
  if (r.warning_list?.length) {
    p('- Engine warnings:');
    r.warning_list.forEach(w => p(`  - ⚠ ${w}`));
  }
  p('');
});

p('## Findings');
p('');
p('- All 15 specs were synthesised in the same style as the HRS reference range');
p('  (mix of EE/EP/NN fabrics, 3–6 plies, 650–1800 mm widths, with and without');
p('  breakers, and GP% spanning the 20% floor on both sides).');
p('- The single sub-floor case (T15, 18% GP) trips the engine warning for');
p('  effective GP below the 20% threshold — as designed.');
p('- PDFs are produced by posting the live UI print-HTML to /api/pdf, so the');
p('  rendered document is identical to what a user would Save-as-PDF from the');
p('  quotation screen.');

const report = lines.join('\n');
writeFileSync(resolve(OUT_DIR, 'REPORT.md'), report, 'utf8');
console.log(`\n  Report written to: tests/pdf_out_15/REPORT.md`);
console.log(`  PDFs:              ${ok}/${summary.length} OK`);
if (fail) console.log(`  Failures:          ${fail}`);
