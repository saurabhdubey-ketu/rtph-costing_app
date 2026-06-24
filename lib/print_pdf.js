// lib/print_pdf.js
// Opens a clean print-preview window for a sent/approved quotation and
// triggers the browser's Save-as-PDF dialog automatically.
// No external libraries — pure HTML + inline CSS + window.print().

import { getCustomer }            from '../masters/customer_master.js';
import { storageGet }             from './storage.js';
import { formatRupees, formatKg, formatDate } from './formatter.js';
import { FABRIC_STRENGTH_MASTER } from '../masters/fabric_strength_master.js';
import { FABRIC_TYPE_MASTER }     from '../masters/fabric_type_master.js';

export function openPrintWindow(quotation, result) {
  if (!quotation || !result) return;

  const q       = quotation;
  const inputs  = result.inputs   || {};
  const snap    = result.snapshot || {};
  const costs   = result.costs    || {};
  const pricing = result.pricing  || {};
  const derived = result.derived  || {};

  // ── Customer lookup ──────────────────────────────────────────────────────────
  const customer = getCustomer(q.customer_id);
  const loc      = q.location_id ? customer?.locations?.find(l => l.id === q.location_id) : null;
  const addr     = loc || customer || {};
  const addrLine = [addr.address, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ') || '—';

  const cName    = customer?.name    || '—';
  const cGst     = addr.gst || customer?.gst || '—';
  const cContact = customer?.contact || '—';
  const cEmail   = addr.email || customer?.email || '—';
  const cPhone   = addr.phone || customer?.phone || '—';

  // ── Belt derived values ──────────────────────────────────────────────────────
  const fabricRow = FABRIC_STRENGTH_MASTER.find(r =>
    r.fabric_type    === inputs.fabric_type &&
    r.total_strength === Number(inputs.fabric_strength) &&
    r.no_of_ply      === Number(inputs.plies)
  );
  const cct = fabricRow?.nominal_carcass_thickness_mm;
  const tbt = cct != null
    ? (cct + (inputs.top_cover_thickness_mm || 0) + (inputs.bottom_cover_thickness_mm || 0)).toFixed(2)
    : (derived.tbt_mm != null ? derived.tbt_mm.toFixed(2) : null);

  const fabricTypeName = FABRIC_TYPE_MASTER.find(r => r.code === inputs.fabric_type)?.name
    ?? inputs.fabric_type ?? '—';
  const combinedRating = (inputs.fabric_type && inputs.fabric_strength && inputs.plies)
    ? `${inputs.fabric_type}-${inputs.fabric_strength}/${inputs.plies}` : '—';

  // ── Enquiry description ──────────────────────────────────────────────────────
  const enquirySubject = q.enquiry_id ? (storageGet(`enquiry.${q.enquiry_id}`)?.subject ?? null) : null;

  // ── Dates ────────────────────────────────────────────────────────────────────
  const printDate = formatDate(new Date());
  const sentDate  = q.sent_at ? formatDate(q.sent_at) : '—';

  const html = buildPrintHTML({
    q, inputs, snap, costs, pricing, derived,
    cName, addrLine, cGst, cContact, cEmail, cPhone,
    cct, tbt, fabricTypeName, combinedRating,
    printDate, sentDate, enquirySubject,
  });

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  }
  // Popup was blocked — revoke immediately and signal failure
  URL.revokeObjectURL(url);
  return false;
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildPrintHTML({
  q,
  inputs:  i,
  snap:    s,
  costs:   c,
  pricing: p,
  derived: d,
  cName, addrLine, cGst, cContact, cEmail, cPhone,
  cct, tbt, fabricTypeName, combinedRating,
  printDate, sentDate, enquirySubject,
}) {
  // Badge colours per status
  const BADGE = {
    sent:    ['#d1fae5', '#065f46', '#a7f3d0'],
    won:     ['#d1fae5', '#065f46', '#a7f3d0'],
    lost:    ['#fee2e2', '#991b1b', '#fca5a5'],
    revised: ['#fef3c7', '#92400e', '#fcd34d'],
    draft:   ['#f3f4f6', '#374151', '#d1d5db'],
  };
  const [bbg, bfg, bbd] = BADGE[q.status] ?? BADGE.draft;

  // Aggregated breaker values (fabric + skim)
  const brkTopWt  = (d.breaker_top_weight_kg      || 0) + (d.breaker_top_skim_weight_kg  || 0);
  const brkBotWt  = (d.breaker_bot_weight_kg      || 0) + (d.breaker_bot_skim_weight_kg  || 0);
  const brkTopCst = (c.breaker_top_cost            || 0) + (c.breaker_top_skim_cost       || 0);
  const brkBotCst = (c.breaker_bot_cost            || 0) + (c.breaker_bot_skim_cost       || 0);

  const hasBreakers = i.breaker_top_id || i.breaker_bot_id;
  const hasDiscount = (i.discount_pct || 0) > 0;
  const hasUsd      = p.quotation_usd != null && i.exchange_rate;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Costing Sheet — ${esc(q.id)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:10pt;color:#2a2f36;background:#e2e8f0;padding:24px}
.page{background:#fff;max-width:800px;margin:0 auto;padding:18mm 16mm;box-shadow:0 4px 24px rgba(0,0,0,.18)}

/* ── Header ── */
.ph{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0F2A44;padding-bottom:12px;margin-bottom:14px}
.brand{font-size:19pt;font-weight:800;color:#0F2A44;letter-spacing:-0.03em;line-height:1}
.brand-sub{font-size:7.5pt;color:#6b7280;margin-top:3px}
.doc-meta{text-align:right}
.doc-type{font-size:7.5pt;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.1em}
.doc-id{font-size:14pt;font-weight:800;color:#0F2A44;line-height:1.2;margin-top:1px}
.doc-date{font-size:8pt;color:#6b7280;margin-top:3px}
.badge{display:inline-block;padding:2px 7px;border-radius:3px;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;vertical-align:middle;background:${bbg};color:${bfg};border:1px solid ${bbd}}

/* ── Section titles ── */
.st{background:#0F2A44;color:#fff;padding:3px 9px;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-top:13px}

/* ── Customer grid ── */
.cg{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dde2e8;padding:7px 10px;gap:2px 0}
.cr{display:flex;gap:5px;padding:1.5px 0}
.cl{font-size:8pt;color:#6b7280;min-width:48px;flex-shrink:0}
.cv{font-size:8.5pt;font-weight:500}

/* ── Tables ── */
table{width:100%;border-collapse:collapse;font-size:8.5pt}
th{background:#f0f4f8;text-align:left;padding:4px 7px;font-size:7pt;font-weight:700;border:1px solid #dde2e8;color:#374151;text-transform:uppercase;letter-spacing:.05em}
th.r{text-align:right}
td{padding:3px 7px;border:1px solid #e5e9ee;vertical-align:top}
td.lb{color:#6b7280;font-size:8pt;background:#fafafa;width:42%}
td.vl{font-weight:500}
td.nm{text-align:right;font-variant-numeric:tabular-nums}
tr.tot td{background:#eef2f7;font-weight:700;border-top:2px solid #0F2A44}
tr.hi td{background:#fffbeb;font-weight:700;border-top:2px solid #d97706}
tr.grand td{background:#0F2A44;color:#fff;font-weight:700;font-size:9.5pt}

/* ── Two-column weight/cost ── */
.tc{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:13px;align-items:start}
.tc .st{margin-top:0}

/* ── Ref bar & footer ── */
.ref{padding:5px 10px;border:1px solid #dde2e8;font-size:8.5pt;display:flex;gap:20px;flex-wrap:wrap}
.ft{margin-top:14px;padding-top:7px;border-top:1px solid #dde2e8;display:flex;justify-content:space-between;font-size:7.5pt;color:#6b7280}

/* ── Screen-only print button ── */
.pbt{position:fixed;top:14px;right:14px;background:#0F2A44;color:#fff;border:none;padding:9px 20px;border-radius:5px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,.28);z-index:999}
.pbt:hover{background:#1a4070}

@media print{
  body{background:#fff;padding:0}
  .page{box-shadow:none;padding:0;max-width:100%}
  .pbt{display:none}
  @page{size:A4;margin:13mm 15mm}
  *{print-color-adjust:exact;-webkit-print-color-adjust:exact}
}
</style>
</head>
<body>
<button class="pbt" onclick="window.print()">&#8659; Save as PDF</button>
<div class="page">

  <!-- Header -->
  <div class="ph">
    <div>
      <div class="brand">RAVASCO</div>
      <div class="brand-sub">Indus Belts &nbsp;&middot;&nbsp; Commercial Data Sheet</div>
    </div>
    <div class="doc-meta">
      <div class="doc-type">Costing Sheet</div>
      <div class="doc-id">${esc(q.id)}&nbsp;<span class="badge">${esc((q.status ?? '').toUpperCase())}</span></div>
      <div class="doc-date">Sent:&nbsp;${sentDate}&nbsp;&nbsp;&middot;&nbsp;&nbsp;Printed:&nbsp;${printDate}</div>
    </div>
  </div>

  <!-- Customer -->
  <div class="st">Customer</div>
  <div class="cg">
    <div class="cr"><span class="cl">Name</span><span class="cv">${esc(cName)}</span></div>
    <div class="cr"><span class="cl">GST</span><span class="cv">${esc(cGst)}</span></div>
    <div class="cr"><span class="cl">Address</span><span class="cv">${esc(addrLine)}</span></div>
    <div class="cr"><span class="cl">Contact</span><span class="cv">${esc(cContact)}</span></div>
    <div class="cr"><span class="cl">Email</span><span class="cv">${esc(cEmail)}</span></div>
    <div class="cr"><span class="cl">Phone</span><span class="cv">${esc(cPhone)}</span></div>
  </div>

  <!-- Belt Specification -->
  <div class="st">Belt Specification</div>
  <table>
    <tbody>
      <tr>
        <td class="lb">Fabric Rating</td><td class="vl">${esc(combinedRating)}</td>
        <td class="lb">Fabric Type</td><td class="vl">${esc(fabricTypeName)}</td>
      </tr>
      <tr>
        <td class="lb">Width</td>
        <td class="vl">${i.width_mm != null ? i.width_mm + ' mm' : '&mdash;'}</td>
        <td class="lb">TBT (Total Belt Thickness)</td>
        <td class="vl">${tbt != null ? tbt + ' mm' : '&mdash;'}</td>
      </tr>
      <tr>
        <td class="lb">Top Cover</td>
        <td class="vl">${i.top_cover_thickness_mm != null ? i.top_cover_thickness_mm + ' mm' : '&mdash;'}${s.top_cover?.code ? ' &middot; ' + esc(s.top_cover.code) : ''}</td>
        <td class="lb">Bottom Cover</td>
        <td class="vl">${i.bottom_cover_thickness_mm != null ? i.bottom_cover_thickness_mm + ' mm' : '&mdash;'}${s.bottom_cover?.code ? ' &middot; ' + esc(s.bottom_cover.code) : ''}</td>
      </tr>
      <tr>
        <td class="lb">Skim Compound</td><td class="vl">${esc(s.skim?.code ?? '&mdash;')}</td>
        <td class="lb">Belt Construction Type</td><td class="vl">${esc(s.edge?.name ?? i.edge_id ?? '&mdash;')}</td>
      </tr>
      ${hasBreakers ? `<tr>
        <td class="lb">Breaker Top (BOT)</td>
        <td class="vl">${i.breaker_top_id ? 'Yes &middot; ' + (i.em_top_ply ?? i.breaker_top_ply ?? '&mdash;') + ' ply' : 'None'}</td>
        <td class="lb">Breaker Bottom (BOB)</td>
        <td class="vl">${i.breaker_bot_id ? 'Yes &middot; ' + (i.em_bot_ply ?? i.breaker_bot_ply ?? '&mdash;') + ' ply' : 'None'}</td>
      </tr>` : ''}
      <tr>
        <td class="lb">Length / Roll</td>
        <td class="vl">${i.length_per_roll_m != null ? i.length_per_roll_m + ' m' : '&mdash;'}</td>
        <td class="lb">No. of Rolls</td>
        <td class="vl">${i.no_of_rolls != null ? i.no_of_rolls : '&mdash;'}</td>
      </tr>
      <tr>
        <td class="lb">Total Length</td>
        <td class="vl">${d.total_length_m != null ? d.total_length_m.toFixed(2) + ' m' : '&mdash;'}</td>
        <td class="lb">Packing / Reel</td>
        <td class="vl">${esc(s.packing?.code ?? '&mdash;')}</td>
      </tr>
      <tr>
        <td class="lb">Freight</td>
        <td class="vl">${i.freight_included ? esc(s.freight?.state_name ?? 'Yes') : 'No'}</td>
        <td class="lb">COP Rate</td>
        <td class="vl">${i.cop_rate_per_kg != null ? '&#8377;' + i.cop_rate_per_kg + ' / kg' : '&mdash;'}</td>
      </tr>
    </tbody>
  </table>

  <!-- Weight + Cost (two columns) -->
  <div class="tc">
    <div>
      <div class="st">Weight Breakdown</div>
      <table>
        <thead><tr><th>Component</th><th class="r">Weight</th></tr></thead>
        <tbody>
          <tr><td>Fabric</td><td class="nm">${formatKg(d.fabric_weight_kg)}</td></tr>
          <tr><td>Top Cover</td><td class="nm">${formatKg(d.top_cover_weight_kg)}</td></tr>
          <tr><td>Bottom Cover</td><td class="nm">${formatKg(d.bottom_cover_weight_kg)}</td></tr>
          <tr><td>Skim</td><td class="nm">${formatKg(d.skim_weight_kg)}</td></tr>
          ${brkTopWt > 0 ? `<tr><td>Breaker Top</td><td class="nm">${formatKg(brkTopWt)}</td></tr>` : ''}
          ${brkBotWt > 0 ? `<tr><td>Breaker Bottom</td><td class="nm">${formatKg(brkBotWt)}</td></tr>` : ''}
          <tr class="tot"><td><strong>Total Belt Weight</strong></td><td class="nm">${formatKg(d.total_belt_weight_kg)}</td></tr>
          <tr><td>Weight / Meter</td><td class="nm">${d.actual_weight_per_meter_kg != null ? formatKg(d.actual_weight_per_meter_kg) + '/m' : '&mdash;'}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div class="st">Cost Breakdown</div>
      <table>
        <thead><tr><th>Component</th><th class="r">Cost</th></tr></thead>
        <tbody>
          <tr><td>Cover (Top + Bottom)</td><td class="nm">${formatRupees((c.top_cover_cost || 0) + (c.bottom_cover_cost || 0))}</td></tr>
          <tr><td>Fabric</td><td class="nm">${formatRupees(c.fabric_cost)}</td></tr>
          <tr><td>Skim</td><td class="nm">${formatRupees(c.skim_cost)}</td></tr>
          ${brkTopCst > 0 ? `<tr><td>Breaker Top</td><td class="nm">${formatRupees(brkTopCst)}</td></tr>` : ''}
          ${brkBotCst > 0 ? `<tr><td>Breaker Bottom</td><td class="nm">${formatRupees(brkBotCst)}</td></tr>` : ''}
          <tr><td>Cost of Production</td><td class="nm">${formatRupees(c.cost_of_production)}</td></tr>
          <tr><td>Packing</td><td class="nm">${formatRupees(c.packing_cost)}</td></tr>
          <tr><td>Freight</td><td class="nm">${formatRupees(c.freight_cost)}</td></tr>
          <tr class="tot"><td><strong>Total Belt Cost</strong></td><td class="nm">${formatRupees(c.total_belt_cost)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Pricing -->
  <div class="st">Pricing</div>
  <table>
    <tbody>
      <tr>
        <td class="lb">Min. Quoting Price / m (RMC)</td>
        <td class="vl">${formatRupees(p.rmc_per_meter)} / m</td>
        <td class="lb">GP %</td>
        <td class="vl">${p.gp_pct_applied != null ? (p.gp_pct_applied * 100).toFixed(1) + '%' : '&mdash;'}</td>
      </tr>
      <tr>
        <td class="lb">RMC With GP / m</td>
        <td class="vl">${p.rmc_with_gp_per_m != null ? formatRupees(p.rmc_with_gp_per_m) + ' / m' : '&mdash;'}</td>
        <td class="lb">Min Quotation RMC / m</td>
        <td class="vl">${p.min_quotation_rmc_per_m != null ? formatRupees(p.min_quotation_rmc_per_m) + ' / m' : '&mdash;'}</td>
      </tr>
      <tr>
        <td class="lb">Per mm Running Price</td>
        <td class="vl">${p.per_mm_running_price_pre_quote != null ? formatRupees(p.per_mm_running_price_pre_quote) + ' / mm' : '&mdash;'}</td>
        <td class="lb"></td>
        <td class="vl"></td>
      </tr>
      <tr>
        <td class="lb">Selling Price / m (CD)</td>
        <td class="vl">${formatRupees(p.cd_price_per_meter)} / m</td>
        <td class="lb">Selling Price / m (VD)</td>
        <td class="vl">${formatRupees(p.vd_price_per_meter)} / m</td>
      </tr>
      ${hasDiscount ? `<tr>
        <td class="lb">Discount Applied</td>
        <td class="vl">${(i.discount_pct * 100).toFixed(1)}%</td>
        <td class="lb">Final Price / m (after discount)</td>
        <td class="vl">${formatRupees(p.cd_final_per_meter)} / m</td>
      </tr>` : ''}
      ${hasUsd ? `<tr>
        <td class="lb">Quotation Rate / m (USD)</td>
        <td class="vl">$${p.quotation_usd.toFixed(2)} / m</td>
        <td class="lb">Exchange Rate</td>
        <td class="vl">&#8377;${i.exchange_rate.toFixed(2)} / USD</td>
      </tr>` : ''}
      <tr class="hi">
        <td class="lb"><strong>Total Order Value (CD)</strong></td>
        <td class="vl">${formatRupees(p.cd_total)}</td>
        <td class="lb"><strong>Total Order Value (VD)</strong></td>
        <td class="vl">${formatRupees(p.vd_total)}</td>
      </tr>
      ${hasDiscount ? `<tr class="grand">
        <td colspan="2"><strong>Final Total &mdash; CD (after ${(i.discount_pct * 100).toFixed(1)}% discount)</strong></td>
        <td colspan="2" class="nm">${formatRupees(p.cd_final_total)}</td>
      </tr>` : ''}
    </tbody>
  </table>

  <!-- Reference / notes -->
  ${(q.enquiry_id || q.special_note || enquirySubject) ? `
  <div class="st">Reference</div>
  <div class="ref">
    ${q.enquiry_id     ? `<span><span style="color:#6b7280">Enquiry Ref:&nbsp;</span>${esc(q.enquiry_id)}</span>` : ''}
    ${enquirySubject   ? `<span><span style="color:#6b7280">Description:&nbsp;</span>${esc(enquirySubject)}</span>` : ''}
    ${q.special_note   ? `<span><span style="color:#6b7280">Note:&nbsp;</span>${esc(q.special_note)}</span>` : ''}
  </div>` : ''}

  <!-- Footer -->
  <div class="ft">
    <span>Frozen: ${sentDate}&nbsp;&nbsp;&middot;&nbsp;&nbsp;Printed: ${printDate}</span>
    <span>Ravasco CDS &nbsp;&middot;&nbsp; Indus Belts &nbsp;&middot;&nbsp; Internal Reference</span>
  </div>

</div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},450);});</script>
</body>
</html>`;
}

function esc(s) {
  if (s == null) return '&mdash;';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
