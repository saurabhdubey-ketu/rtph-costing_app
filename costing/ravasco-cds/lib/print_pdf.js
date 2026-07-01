// lib/print_pdf.js
// Opens a clean print-preview window for a sent/approved quotation and
// triggers the browser's Save-as-PDF dialog automatically.

import { getCustomer }            from '../masters/customer_master.js';
import { storageGet }             from './storage.js';
import { formatRupees, formatKg, formatDate } from './formatter.js';
import { FABRIC_STRENGTH_MASTER } from '../masters/fabric_strength_master.js';
import { FABRIC_TYPE_MASTER }     from '../masters/fabric_type_master.js';
import { BELT_TYPE_MASTER }       from '../masters/belt_type_master.js';

export function getQuotationHTML(quotation, _legacyResult) {
  if (!quotation) return null;

  const q        = quotation;
  const customer = getCustomer(q.customer_id);
  const loc      = q.location_id ? customer?.locations?.find(l => l.id === q.location_id) : null;
  const addr     = loc || customer || {};
  const addrLine = [addr.address, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ') || '—';

  const cName    = customer?.name    || '—';
  const cGst     = addr.gst || customer?.gst || '—';
  const cContact = customer?.contact || '—';
  const cEmail   = addr.email || customer?.email || '—';
  const cPhone   = addr.phone || customer?.phone || '—';

  const enquirySubject = q.enquiry_id ? (storageGet(`enquiry.${q.enquiry_id}`)?.subject ?? null) : null;
  const printDate = formatDate(new Date());
  const sentDate  = q.sent_at ? formatDate(q.sent_at) : '—';

  const linesWithResults = (q.lines ?? []).filter(l => l.result);
  if (linesWithResults.length === 0 && _legacyResult) {
    linesWithResults.push({ result: _legacyResult });
  }
  if (linesWithResults.length === 0) return null;

  const firstResult = linesWithResults[0].result;
  const firstInputs = firstResult.inputs || {};
  const firstDerived = firstResult.derived || {};
  const combinedRating0 = (firstInputs.fabric_type && firstInputs.fabric_strength && firstInputs.plies)
    ? `${firstInputs.fabric_type}-${firstInputs.fabric_strength}/${firstInputs.plies}` : '—';

  return {
    html: buildPrintHTML({
      q, linesWithResults,
      cName, addrLine, cGst, cContact, cEmail, cPhone,
      printDate, sentDate, enquirySubject,
    }),
    cName,
    cEmail,
    combinedRating: combinedRating0,
    inputs:  firstInputs,
    derived: firstDerived,
  };
}

async function _inlineLogo(html) {
  try {
    const resp = await fetch('/assets/icons/indus_logo.png');
    if (!resp.ok) return html;
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload  = () => resolve(html.split('/assets/icons/indus_logo.png').join(reader.result));
      reader.onerror = () => resolve(html);
      reader.readAsDataURL(blob);
    });
  } catch { return html; }
}

export async function openPrintWindow(quotation, result) {
  if (!quotation || !result) return;

  const info = getQuotationHTML(quotation, result);
  if (!info) return;
  const html = await _inlineLogo(info.html);
  const filename = quotation.id || 'Quotation';

  try {
    const resp = await fetch('/api/pdf', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ html, filename }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${resp.status}`);
    }
    const pdfData = await resp.arrayBuffer();
    const blob = new Blob([pdfData], { type: 'application/octet-stream' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return true;
  } catch (err) {
    console.warn('PDF server unavailable — falling back to print dialog:', err.message);
    return _printFallback(html, filename);
  }
}

function _printFallback(html, filename) {
  document.getElementById('ravasco-pdf-frame')?.remove();
  const frame = document.createElement('iframe');
  frame.id = 'ravasco-pdf-frame';
  frame.style.cssText = 'position:fixed;width:0;height:0;border:none;top:-9999px;left:-9999px;';
  document.body.appendChild(frame);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  frame.src  = url;
  frame.addEventListener('load', () => {
    URL.revokeObjectURL(url);
    frame.contentWindow.focus();
    const prevTitle = document.title;
    if (filename) document.title = filename;
    frame.contentWindow.print();
    const restore = () => { document.title = prevTitle; };
    const cleanup = () => { restore(); frame.remove(); };
    frame.contentWindow.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 120_000);
  });
  return true;
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildPrintHTML({ q, linesWithResults, cName, addrLine, cGst, cContact, cEmail, cPhone, printDate, sentDate, enquirySubject }) {
  const multiLine = linesWithResults.length > 1;
  const revMatch  = q.id?.match(/-R(\d+)$/);
  const revNum    = revMatch ? parseInt(revMatch[1]) : 0;
  const revLabel  = revNum > 0 ? `REVISION ${revNum}` : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(q.id)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Trebuchet MS','Arial Narrow',Arial,sans-serif;font-size:10pt;color:#1a1a1a;background:#f5f5f5;padding:18px}
.page{background:#fff;max-width:1100px;margin:0 auto;box-shadow:0 4px 24px rgba(0,0,0,.08)}

/* ── Brand header strip ── */
.ph{display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:2px solid #c2700e;padding:14px 20px}
.ph-logo{width:280px;text-align:center;flex-shrink:0}
.ph-logo img{display:block;width:100%;height:auto;max-height:160px;object-fit:contain;margin:0 auto}
.ph-center{flex:1;text-align:center}
.ph-company{font-weight:800;font-size:12pt;color:#1a1a1a;margin-bottom:3px}
.ph-addr{font-size:8pt;color:#444;line-height:1.5}
.ph-addr a{color:#0f4cc2;text-decoration:none}
.ph-meta{text-align:right;flex-shrink:0;min-width:110px}
.ph-qid{font-size:8pt;font-family:monospace;color:#555;word-break:break-all}
.ph-rev{display:inline-block;margin-top:5px;background:#c2700e;color:#fff;font-size:8pt;font-weight:800;letter-spacing:.08em;padding:3px 9px;border-radius:3px}
/* ── Page content ── */
.pc{padding:10px 14px 14px}

/* ── Section label ── */
.sl{display:flex;align-items:center;gap:8px;font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#c2700e;margin:13px 0 5px}
.sl::after{content:'';flex:1;height:1px;background:#f0e6d6}

/* ── Belt heading (multi-line) ── */
.bh{background:#e58025;color:#fff;padding:6px 20px;font-size:9.5pt;font-weight:800;margin:16px -20px 0;border-top:3px solid #c2700e;font-family:Georgia,'Times New Roman',serif;letter-spacing:.04em}

/* ── Customer grid ── */
.cg{display:grid;grid-template-columns:repeat(3,1fr);gap:3px 18px;background:#fcf5ec;border:1px solid #f0e6d6;padding:8px 11px}
.cr{display:flex;gap:5px;align-items:baseline;padding:1.5px 0}
.cl{font-size:7.5pt;color:#666;flex-shrink:0;min-width:44px}
.cv{font-size:8.5pt;font-weight:600}

/* ── Tables ── */
table{width:100%;border-collapse:collapse;font-size:8.5pt}
th{background:#fcf5ec;color:#c2700e;font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.07em;padding:4px 8px;border-bottom:1.5px solid #c2700e;text-align:left}
th.r{text-align:right}
td{padding:3.5px 8px;border-bottom:1px solid #f0e6d6;vertical-align:top}
td.lb{color:#666;font-size:7.5pt;white-space:nowrap;width:1%;padding-right:12px}
td.lb.cf{color:#c2700e;background:#fcf5ec}
td.vl{font-weight:600;width:auto}
td.nm{text-align:right;font-variant-numeric:tabular-nums;font-weight:500}
tr:last-child td{border-bottom:none}
tr.tot td{background:#fcf5ec;font-weight:700;border-top:1.5px solid #c2700e;border-bottom:none}
tr.grand td{background:#e58025;color:#fff;font-weight:700;font-size:9.5pt;border-top:2px solid #c2700e;border-bottom:none}

/* ── Two-column weight/cost ── */
.tc{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:13px}
.tc .sl{margin-top:0}

/* ── Special note banner ── */
.note-strip{margin-top:13px;padding:9px 14px;background:#fffaeb;border:1px solid #f0c040;border-left:4px solid #c2700e;border-radius:4px;font-size:8.5pt;display:flex;gap:10px;align-items:baseline}
.note-strip .nlbl{font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#8a6b00;flex-shrink:0}
.note-strip .nval{color:#1a1a1a;line-height:1.45;word-break:break-word}

/* ── Sub-section table (compact follow-up tables) ── */
.subt{margin-top:8px}
.subt th{background:#fcf5ec;color:#c2700e}

/* ── Section heading (orange band) ── */
.sec-bar{background:#e58025;color:#fff;font-weight:800;font-size:9pt;letter-spacing:.06em;padding:6px 12px;text-transform:uppercase;margin:13px 0 0}

/* ── Ref bar & footer ── */
.ref{padding:6px 11px;background:#fcf5ec;border:1px solid #f0e6d6;font-size:8pt;display:flex;gap:20px;flex-wrap:wrap}
.ft{margin-top:13px;padding-top:7px;border-top:1px solid #f0e6d6;display:flex;justify-content:space-between;font-size:7pt;color:#666}

/* ── Screen print button ── */
.pbt{position:fixed;top:14px;right:14px;background:#e58025;color:#fff;border:none;padding:9px 20px;border-radius:5px;cursor:pointer;font-size:13px;font-weight:700;box-shadow:0 2px 10px rgba(0,0,0,.2);z-index:999}
.pbt:hover{background:#c2700e}

@media print{
  body{background:#fff;padding:0}
  .page{box-shadow:none;max-width:100%}
  .pbt{display:none}
  @page{size:A4;margin:8mm 8mm}
  *{print-color-adjust:exact;-webkit-print-color-adjust:exact}
}
</style>
</head>
<body>
<button class="pbt" onclick="window.print()">&#8659; Save as PDF</button>
<div class="page">

  <!-- Header (Indus logo + Ravasco company info + doc id) -->
  <div class="ph">
    <div class="ph-logo">
      <img src="/assets/icons/indus_logo.png" alt="Indus — Engineered to Deliver">
    </div>
    <div class="ph-center">
      <div class="ph-company">Ravasco Transmission &amp; Packing Pvt Ltd.</div>
      <div class="ph-addr">1, Janki Centre, Off Veera Desai Road, Andheri (W), Mumbai &mdash; 400053</div>
      <div class="ph-addr">Maharashtra State, India &nbsp;|&nbsp; Pin Code : 400053</div>
      <div class="ph-addr"><a>www.indusbelts.com</a> &nbsp;/&nbsp; technical@ravasco.com</div>
    </div>
    <div class="ph-meta">
      <div class="ph-qid">${esc(q.id ?? '')}</div>
      ${revLabel ? `<div class="ph-rev">${esc(revLabel)}</div>` : ''}
    </div>
  </div>

  <div class="pc">

    <!-- Customer -->
    <div class="sl">Customer</div>
    <div class="cg">
      <div class="cr"><span class="cl">Name</span><span class="cv">${esc(cName)}</span></div>
      <div class="cr"><span class="cl">GST</span><span class="cv">${esc(cGst)}</span></div>
      <div class="cr"><span class="cl">Contact</span><span class="cv">${esc(cContact)}</span></div>
      <div class="cr"><span class="cl">Address</span><span class="cv">${esc(addrLine)}</span></div>
      <div class="cr"><span class="cl">Email</span><span class="cv">${esc(cEmail)}</span></div>
      <div class="cr"><span class="cl">Phone</span><span class="cv">${esc(cPhone)}</span></div>
    </div>

    ${q.special_note ? `
    <!-- Special Note banner -->
    <div class="note-strip">
      <span class="nlbl">Special Note</span>
      <span class="nval">${esc(q.special_note)}</span>
    </div>` : ''}

    <!-- Belt lines -->
    ${linesWithResults.map((lineData, idx) => buildLineHTML(lineData, idx, linesWithResults.length)).join('')}

    <!-- Reference / notes -->
    ${(q.enquiry_id || q.special_note || enquirySubject) ? `
    <div class="sl">Reference</div>
    <div class="ref">
      ${q.enquiry_id   ? `<span><span style="color:#c2700e">Enquiry Ref:&nbsp;</span>${esc(q.enquiry_id)}</span>` : ''}
      ${enquirySubject ? `<span><span style="color:#c2700e">Description:&nbsp;</span>${esc(enquirySubject)}</span>` : ''}
      ${q.special_note ? `<span><span style="color:#c2700e">Note:&nbsp;</span>${esc(q.special_note)}</span>` : ''}
    </div>` : ''}

    <!-- Footer -->
    <div class="ft">
      <span>Frozen: ${sentDate}&nbsp;&nbsp;&middot;&nbsp;&nbsp;Printed: ${printDate}${revLabel ? `&nbsp;&nbsp;&middot;&nbsp;&nbsp;<strong>${esc(revLabel)}</strong>` : ''}</span>
      <span>Ravasco Transmission &amp; Packing Pvt Ltd. &nbsp;&middot;&nbsp; Internal Reference &nbsp;&middot;&nbsp; ${esc(q.id ?? '')}</span>
    </div>

  </div>
</div>
<script>document.querySelector('.pbt')?.addEventListener('click',function(){window.print();});</script>
</body>
</html>`;
}

// ─── Per-line section builder ─────────────────────────────────────────────────

function buildLineHTML(lineData, lineIdx, totalLines) {
  const result = lineData.result;
  if (!result) return '';

  const i = result.inputs   || {};
  const s = result.snapshot || {};
  const c = result.costs    || {};
  const p = result.pricing  || {};
  const d = result.derived  || {};

  const fabricRow = FABRIC_STRENGTH_MASTER.find(r =>
    r.fabric_type    === i.fabric_type &&
    r.total_strength === Number(i.fabric_strength) &&
    r.no_of_ply      === Number(i.plies)
  );
  const cct = fabricRow?.nominal_carcass_thickness_mm;
  const tbt = cct != null
    ? (cct + (i.top_cover_thickness_mm || 0) + (i.bottom_cover_thickness_mm || 0)).toFixed(2)
    : (d.tbt_mm != null ? d.tbt_mm.toFixed(2) : null);

  const fabricTypeName  = FABRIC_TYPE_MASTER.find(r => r.code === i.fabric_type)?.name ?? i.fabric_type ?? '—';
  const combinedRating  = (i.fabric_type && i.fabric_strength && i.plies)
    ? `${i.fabric_type}-${i.fabric_strength}/${i.plies}` : '—';

  const brkTopWt  = (d.breaker_top_weight_kg  || 0) + (d.breaker_top_skim_weight_kg || 0);
  const brkBotWt  = (d.breaker_bot_weight_kg  || 0) + (d.breaker_bot_skim_weight_kg || 0);
  const brkTopCst = (c.breaker_top_cost        || 0) + (c.breaker_top_skim_cost      || 0);
  const brkBotCst = (c.breaker_bot_cost        || 0) + (c.breaker_bot_skim_cost      || 0);

  const hasBreakers = i.breaker_top_id || i.breaker_bot_id;
  const hasDiscount = (i.discount_pct || 0) > 0;
  const hasUsd      = p.quotation_usd != null && i.exchange_rate;
  const hasFx       = Number(i.exchange_rate) > 0;

  const beltTypeName     = BELT_TYPE_MASTER.find(r => r.id === i.belt_type_id)?.name ?? i.belt_type_id ?? '—';
  const constructionType = i.open_end_type === 'ENDLESS' ? 'Endless' : 'Open End';
  const beltDescription = [
    i.width_mm != null ? `${i.width_mm} mm` : null,
    i.fabric_make || null,
    i.fabric_type || null,
    (i.fabric_strength != null && i.plies != null) ? `${i.fabric_strength}/${i.plies}` : null,
    (i.top_cover_thickness_mm != null && i.bottom_cover_thickness_mm != null) ? `${i.top_cover_thickness_mm} × ${i.bottom_cover_thickness_mm}` : null,
    s.edge?.name ?? null,
    constructionType,
    i.construction_grade ?? null,
  ].filter(Boolean).join(' × ');

  const pageBreak = lineIdx > 0 ? ' style="page-break-before:always;break-before:page"' : '';
  const heading = totalLines > 1
    ? `<div class="bh">Belt ${lineIdx + 1} &mdash; ${esc(combinedRating)} &nbsp;&middot;&nbsp; ${i.width_mm != null ? i.width_mm + ' mm' : ''}</div>`
    : '';

  return `
  <div${pageBreak}>
  ${heading}

  <!-- Fabric & Grade -->
  <div class="sl">Fabric &amp; Grade</div>
  <table><tbody>
    <tr>
      <td class="lb">Fabric Type</td>
      <td class="vl">${esc(fabricTypeName)}</td>
      <td class="lb cf">Customer Fabric Type</td>
      <td class="vl">${i.customer_fabric_type ? esc(FABRIC_TYPE_MASTER.find(r => r.code === i.customer_fabric_type)?.name ?? i.customer_fabric_type) : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Fabric Strength</td>
      <td class="vl">${i.fabric_strength != null ? i.fabric_strength + ' kN/m' : '&mdash;'}</td>
      <td class="lb cf">Customer Fabric Strength</td>
      <td class="vl">${i.customer_fabric_strength != null ? i.customer_fabric_strength + ' kN/m' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Construction Grade</td>
      <td class="vl">${esc(i.construction_grade)}</td>
      <td class="lb cf">Customer Grade</td>
      <td class="vl">${esc(i.customer_grade)}</td>
    </tr>
  </tbody></table>

  <!-- Belt Specification -->
  <div class="sl">Belt Specification</div>
  <table><tbody>
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
      <td class="lb">Skim Compound</td><td class="vl">${esc(s.skim?.code)}</td>
      <td class="lb">Belt Construction Type</td><td class="vl">${esc(s.edge?.name ?? i.edge_id)}</td>
    </tr>
    ${hasBreakers ? `<tr>
      <td class="lb">Breaker Top (BOT)</td>
      <td class="vl">${i.breaker_top_id ? 'Yes &middot; ' + (i.breaker_top_ply ?? '&mdash;') + ' ply' : 'None'}</td>
      <td class="lb">Breaker Bottom (BOB)</td>
      <td class="vl">${i.breaker_bot_id ? 'Yes &middot; ' + (i.breaker_bot_ply ?? '&mdash;') + ' ply' : 'None'}</td>
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
      <td class="vl">${esc(s.packing?.code)}${s.reel?.code ? ' / ' + esc(s.reel.code) : ''}</td>
    </tr>
    <tr>
      <td class="lb">Freight</td>
      <td class="vl">${i.freight_included ? esc(s.freight?.state_name ?? 'Yes') : 'No'}</td>
      <td class="lb">COP Rate</td>
      <td class="vl">${i.cop_rate_per_kg != null ? '&#8377;' + i.cop_rate_per_kg + ' / kg' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Belt Type</td>
      <td class="vl">${esc(beltTypeName)}</td>
      <td class="lb">Construction</td>
      <td class="vl">${esc(constructionType)}</td>
    </tr>
    ${i.open_end_type === 'ENDLESS' ? `<tr>
      <td class="lb">Endless Length</td>
      <td class="vl">${i.endless_length_m != null ? i.endless_length_m + ' m' : '&mdash;'}</td>
      <td class="lb"></td><td class="vl"></td>
    </tr>` : ''}
    <tr>
      <td class="lb">Construction Grade</td>
      <td class="vl">${esc(i.construction_grade)}</td>
      <td class="lb">Customer Grade</td>
      <td class="vl">${esc(i.customer_grade)}</td>
    </tr>
    <tr>
      <td class="lb">Carcass &middot; Master</td>
      <td class="vl">${cct != null ? cct.toFixed(2) + ' mm' : '&mdash;'}</td>
      <td class="lb">Customer CCT</td>
      <td class="vl">${i.customer_carcass_thickness_mm != null ? Number(i.customer_carcass_thickness_mm).toFixed(2) + ' mm' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">TBT &middot; Calculated</td>
      <td class="vl">${d.tbt_mm != null ? d.tbt_mm.toFixed(2) + ' mm' : '&mdash;'}</td>
      <td class="lb">Customer TBT</td>
      <td class="vl">${i.customer_tbt_mm != null ? Number(i.customer_tbt_mm).toFixed(2) + ' mm' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Reel Type</td>
      <td class="vl">${esc(s.reel?.code)}</td>
      <td class="lb">Packing Type</td>
      <td class="vl">${esc(s.packing?.code)}</td>
    </tr>
    <tr>
      <td class="lb">Short Form</td>
      <td class="vl">${esc(combinedRating)}</td>
      <td class="lb">Description</td>
      <td class="vl">${esc(beltDescription)}</td>
    </tr>
  </tbody></table>

  <!-- As-Used Rates -->
  <div class="sec-bar">As-Used Rates</div>
  <table class="subt"><thead><tr><th>Component</th><th>SG / GSM</th><th>Rate &#8377;/kg</th></tr></thead><tbody>
    <tr>
      <td class="lb">Top Cover</td>
      <td class="vl">${s.top_cover?.sg != null ? s.top_cover.sg.toFixed(3) : '&mdash;'}</td>
      <td class="vl">${s.top_cover?.price_per_kg != null ? formatRupees(s.top_cover.price_per_kg) + ' / kg' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Bottom Cover</td>
      <td class="vl">${s.bottom_cover?.sg != null ? s.bottom_cover.sg.toFixed(3) : '&mdash;'}</td>
      <td class="vl">${s.bottom_cover?.price_per_kg != null ? formatRupees(s.bottom_cover.price_per_kg) + ' / kg' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Skim</td>
      <td class="vl">${s.skim?.sg != null ? s.skim.sg.toFixed(3) : '&mdash;'}</td>
      <td class="vl">${s.skim?.price_per_kg != null ? formatRupees(s.skim.price_per_kg) + ' / kg' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Fabric</td>
      <td class="vl">${d.fabric_gsm != null ? d.fabric_gsm.toFixed(1) + ' g/m&sup2;' : '&mdash;'}</td>
      <td class="vl">${s.fabric?.price_per_kg != null ? formatRupees(s.fabric.price_per_kg) + ' / kg' : '&mdash;'}</td>
    </tr>
    ${s.breaker_top ? `<tr>
      <td class="lb">Breaker Top</td>
      <td class="vl">${s.breaker_top.gsm != null ? s.breaker_top.gsm.toFixed(1) + ' g/m&sup2;' : '&mdash;'}</td>
      <td class="vl">${s.breaker_top.price_per_kg != null ? formatRupees(s.breaker_top.price_per_kg) + ' / kg' : '&mdash;'}</td>
    </tr>` : ''}
    ${s.breaker_bot ? `<tr>
      <td class="lb">Breaker Bottom</td>
      <td class="vl">${s.breaker_bot.gsm != null ? s.breaker_bot.gsm.toFixed(1) + ' g/m&sup2;' : '&mdash;'}</td>
      <td class="vl">${s.breaker_bot.price_per_kg != null ? formatRupees(s.breaker_bot.price_per_kg) + ' / kg' : '&mdash;'}</td>
    </tr>` : ''}
    <tr class="tot"><td><strong>Blended SG</strong></td><td colspan="2" class="nm">${d.sg_blended != null ? d.sg_blended.toFixed(4) : '&mdash;'}</td></tr>
  </tbody></table>

  <table class="subt"><tbody>
    <tr>
      <td class="lb">COP Rate</td>
      <td class="vl">${(s.eff_cop_rate_per_kg ?? s.cop_rate_per_kg) != null ? formatRupees(s.eff_cop_rate_per_kg ?? s.cop_rate_per_kg) + ' / kg' : '&mdash;'}</td>
      <td class="lb">Expenses / kg</td>
      <td class="vl">${s.expenses_per_kg != null ? formatRupees(s.expenses_per_kg) + ' / kg' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Effective Production Rate</td>
      <td class="vl">${s.eff_production_rate_per_kg != null ? formatRupees(s.eff_production_rate_per_kg) + ' / kg' : '&mdash;'}</td>
      <td class="lb">Packing Cost / m</td>
      <td class="vl">${p.crate_cost_per_m != null && p.crate_cost_per_m > 0 ? formatRupees(p.crate_cost_per_m) + ' / m' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Reel Cost / m</td>
      <td class="vl">${p.reel_cost_per_m != null && p.reel_cost_per_m > 0 ? formatRupees(p.reel_cost_per_m) + ' / m' : '&mdash;'}</td>
      <td class="lb">Freight Rate</td>
      <td class="vl">${s.freight?.rate_per_kg != null ? formatRupees(s.freight.rate_per_kg) + ' / kg' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Freight Destination</td>
      <td class="vl" colspan="3">${esc(s.freight?.state_name)}</td>
    </tr>
  </tbody></table>

  <!-- Weight + Cost two-column -->
  <div class="tc">
    <div>
      <div class="sl">Weight Breakdown</div>
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
          <tr><td style="color:#666">Weight / Meter (actual)</td><td class="nm" style="color:#666">${d.actual_weight_per_meter_kg != null ? formatKg(d.actual_weight_per_meter_kg) + '/m' : '&mdash;'}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div class="sl">Cost Breakdown</div>
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
          ${c.reel_cost > 0 ? `<tr><td>Reel</td><td class="nm">${formatRupees(c.reel_cost)}</td></tr>` : ''}
          <tr><td>Freight</td><td class="nm">${formatRupees(c.freight_cost)}</td></tr>
          <tr class="tot"><td><strong>Total Belt Cost</strong></td><td class="nm">${formatRupees(c.total_belt_cost)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Pricing -->
  <div class="sl">Pricing</div>
  <table><tbody>
    <tr>
      <td class="lb">Material Cost / m</td>
      <td class="vl">${formatRupees(p.material_cost_per_m)} / m</td>
      <td class="lb">Manufacturing Cost / m</td>
      <td class="vl">${formatRupees((c.material_cost_per_m || 0) + (c.cop_per_m || 0) + (c.expenses_per_m || 0))} / m</td>
    </tr>
    <tr>
      <td class="lb">GP %</td>
      <td class="vl" colspan="3">${p.gp_pct_applied != null ? (p.gp_pct_applied * 100).toFixed(1) + '%' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Quotation Cost / m (Standard)</td>
      <td class="vl">${formatRupees(p.cd_price_per_meter)} / m</td>
      <td class="lb">VD Price / m</td>
      <td class="vl">${formatRupees(p.vd_price_per_meter)} / m</td>
    </tr>
    <tr>
      <td class="lb">Per mm Running Price</td>
      <td class="vl">${p.per_mm_running_price_pre_quote != null ? formatRupees(p.per_mm_running_price_pre_quote) + ' / mm' : '&mdash;'}</td>
      <td class="lb"></td><td class="vl"></td>
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
    <tr class="tot">
      <td class="lb"><strong>Total Order Value (Standard)</strong></td>
      <td class="vl">${formatRupees(p.cd_total)}</td>
      <td class="lb"><strong>Total Order Value (VD)</strong></td>
      <td class="vl">${formatRupees(p.vd_total)}</td>
    </tr>
    ${hasDiscount ? `<tr class="grand">
      <td colspan="2"><strong>Final Total &mdash; CD (after ${(i.discount_pct * 100).toFixed(1)}% discount)</strong></td>
      <td colspan="2" class="nm">${formatRupees(p.cd_final_total)}</td>
    </tr>` : ''}
  </tbody></table>

  <!-- Geometry -->
  <div class="sec-bar">Geometry</div>
  <table class="subt"><tbody>
    <tr>
      <td class="lb">Effective Width</td>
      <td class="vl">${d.effective_width_m != null ? d.effective_width_m.toFixed(4) + ' m' : '&mdash;'}</td>
      <td class="lb">Effective Length</td>
      <td class="vl">${d.effective_length_m != null ? d.effective_length_m.toFixed(3) + ' m' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Width Factor</td>
      <td class="vl">${d.width_factor != null ? d.width_factor.toFixed(4) : '&mdash;'}</td>
      <td class="lb">Length Factor</td>
      <td class="vl">${d.length_factor != null ? d.length_factor.toFixed(4) : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Compound GSM</td>
      <td class="vl">${d.compound_gsm != null ? d.compound_gsm.toFixed(1) + ' g/m&sup2;' : '&mdash;'}</td>
      <td class="lb">Total Belt Thickness</td>
      <td class="vl">${d.tbt_mm != null ? d.tbt_mm.toFixed(2) + ' mm' : '&mdash;'}</td>
    </tr>
  </tbody></table>

  <!-- Extended Costing -->
  <div class="sec-bar">Other Costs</div>
  <table class="subt"><thead><tr><th>Component</th><th class="r">&#8377; / m</th><th class="r">Total &#8377;</th></tr></thead><tbody>
    <tr>
      <td>Cost of Production</td>
      <td class="nm">${c.cop_per_m != null && c.cop_per_m > 0 ? formatRupees(c.cop_per_m) + ' / m' : '&mdash;'}</td>
      <td class="nm">${c.cost_of_production != null && c.cost_of_production >= 0 ? formatRupees(c.cost_of_production) : '&mdash;'}</td>
    </tr>
    <tr>
      <td>Expenses</td>
      <td class="nm">${c.expenses_per_m != null && c.expenses_per_m > 0 ? formatRupees(c.expenses_per_m) + ' / m' : '&mdash;'}</td>
      <td class="nm">${c.expenses_cost != null && c.expenses_cost >= 0 ? formatRupees(c.expenses_cost) : '&mdash;'}</td>
    </tr>
    <tr>
      <td>Total Compound Cost <span style="color:#666">(T + B + S + BOT/BOB skim)</span></td>
      <td class="nm">${c.compound_cost_per_m != null && c.compound_cost_per_m > 0 ? formatRupees(c.compound_cost_per_m) + ' / m' : '&mdash;'}</td>
      <td class="nm">${c.total_compound_cost != null && c.total_compound_cost >= 0 ? formatRupees(c.total_compound_cost) : '&mdash;'}</td>
    </tr>
    <tr>
      <td>Fabric + BOT + BOB</td>
      <td class="nm">${c.fabric_plus_breaker_cost_per_m != null && c.fabric_plus_breaker_cost_per_m > 0 ? formatRupees(c.fabric_plus_breaker_cost_per_m) + ' / m' : '&mdash;'}</td>
      <td class="nm">${c.fabric_plus_breaker_cost != null && c.fabric_plus_breaker_cost >= 0 ? formatRupees(c.fabric_plus_breaker_cost) : '&mdash;'}</td>
    </tr>
    <tr>
      <td>Compound Price / kg</td>
      <td colspan="2" class="nm">${c.compound_price_per_kg != null && c.compound_price_per_kg > 0 ? formatRupees(c.compound_price_per_kg) + ' / kg' : '&mdash;'}</td>
    </tr>
  </tbody></table>

  <!-- GP & Per-mm Metrics -->
  <div class="sec-bar">GP &amp; Per-mm Metrics</div>
  <table class="subt"><tbody>
    <tr>
      <td class="lb">GP % Applied</td>
      <td class="vl">${p.gp_pct_applied != null ? (p.gp_pct_applied * 100).toFixed(2) + ' %' : '&mdash;'}</td>
      <td class="lb">Effective GP % (Standard)</td>
      <td class="vl">${p.effective_gp_pct_cd != null ? (p.effective_gp_pct_cd * 100).toFixed(2) + ' %' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">GP Value (Standard)</td>
      <td class="vl">${p.gp_value_cd != null ? formatRupees(p.gp_value_cd) : '&mdash;'}</td>
      <td class="lb">GP Value (VD)</td>
      <td class="vl">${p.gp_value_vd != null ? formatRupees(p.gp_value_vd) : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Per mm Running Price (Standard)</td>
      <td class="vl">${p.per_mm_cd_price != null ? formatRupees(p.per_mm_cd_price) + ' / mm' : '&mdash;'}</td>
      <td class="lb">Per mm Running Price (VD)</td>
      <td class="vl">${p.per_mm_vd_price != null ? formatRupees(p.per_mm_vd_price) + ' / mm' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Floor Price / mm</td>
      <td class="vl">${p.per_mm_running_price_pre_quote != null ? formatRupees(p.per_mm_running_price_pre_quote) + ' / mm' : '&mdash;'}</td>
      <td class="lb">RMC with GP / m</td>
      <td class="vl">${p.rmc_with_gp_per_m != null ? formatRupees(p.rmc_with_gp_per_m) + ' / m' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Floor Price / m</td>
      <td class="vl">${p.min_quotation_rmc_per_m != null ? formatRupees(p.min_quotation_rmc_per_m) + ' / m' : '&mdash;'}</td>
      <td class="lb"></td><td class="vl"></td>
    </tr>
  </tbody></table>

  ${hasFx ? `
  <!-- FX / USD Pricing -->
  <div class="sec-bar">FX / USD Pricing</div>
  <table class="subt"><tbody>
    <tr>
      <td class="lb">Exchange Rate</td>
      <td class="vl">&#8377;${Number(i.exchange_rate).toFixed(2)} / unit</td>
      <td class="lb">Min Quoting Price / m (USD)</td>
      <td class="vl">${p.rmc_usd != null ? '$' + p.rmc_usd.toFixed(2) + ' / m' : '&mdash;'}</td>
    </tr>
    <tr>
      <td class="lb">Standard Quotation Rate / m (USD)</td>
      <td class="vl">${p.quotation_usd != null ? '$' + p.quotation_usd.toFixed(2) + ' / m' : '&mdash;'}</td>
      <td class="lb">VD Quotation Rate / m (USD)</td>
      <td class="vl">${p.quotation_vd_usd != null ? '$' + p.quotation_vd_usd.toFixed(2) + ' / m' : '&mdash;'}</td>
    </tr>
    <tr class="tot">
      <td class="lb"><strong>Total Order Value (USD)</strong></td>
      <td colspan="3" class="nm">${(p.cd_total != null && Number(i.exchange_rate) > 0) ? '$' + (p.cd_total / Number(i.exchange_rate)).toFixed(2) : '&mdash;'}</td>
    </tr>
  </tbody></table>` : ''}

  </div>`;
}

function esc(s) {
  if (s == null) return '&mdash;';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
