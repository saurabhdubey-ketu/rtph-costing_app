// Costing form — exact structure per user specification.
// modules/quotation_form.js
// Layout: Product → Belt Spec → Quantity → COP → Packing → Freight → GP → [Calculate] → Results

import { storageGet, storageSet, storageGetAll } from '../lib/storage.js';
import { nextQuotationId, revisionId }           from '../lib/id.js';
import { auditLog }                              from '../lib/audit.js';
import { formatRupees, formatKg, formatPct }     from '../lib/formatter.js';
import { validate }                              from '../lib/validator.js';
import { runEngine }                             from '../engine/engine.js';

import { PRODUCT_MASTER }                            from '../masters/product_master.js';
import { BELT_TYPE_MASTER }                          from '../masters/belt_type_master.js';
import { FABRIC_TYPE_MASTER }                        from '../masters/fabric_type_master.js';
import { GRADE_MASTER }                             from '../masters/grade_master.js';
import { FABRIC_STRENGTH_MASTER }                    from '../masters/fabric_strength_master.js';
import { FABRIC_RATE_MASTER }                        from '../masters/fabric_rate_master.js';
import { FABRIC_SUPPLIER_MASTER }                   from '../masters/fabric_supplier_master.js';
import { COVER_SKIM_COMPATIBILITY }   from '../masters/compound_master.js';
import { COVER_THICKNESS_MASTER }     from '../masters/cover_thickness_master.js';
import { getWidthOptions, findWidth } from '../masters/width_master.js';
import { GP_MASTER }                  from '../masters/gp_master.js';
import { getAllCurrencies, initCurrencyDefaults } from '../masters/currency_master.js';
import { getAllCustomers, getAllCustomerLocations, parseOptionKey, getCustomer } from '../masters/customer_master.js';
import { mountCombobox }    from '../lib/dropdown.js';
import { openPrintWindow }  from '../lib/print_pdf.js';
import { openEmailModal }   from '../lib/email_modal.js';
// Editable masters — read live so admin changes take effect immediately
import {
  getLiveCompounds, getLiveBreakers, getLivePacking,
  getLiveFreight,   getLiveEdges,
} from '../lib/master_store.js';

let _currentResult     = null;
let _currentQuotation  = null;
let _isReadOnly        = false;
let _gradeFilter       = 'ALL';   // grade-family chip filter for compound dropdowns

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderQuotationForm(container, params = {}) {
  const existingId = params.id;
  const isRevise   = params.action === 'revise';
  const isView     = params.action === 'view';
  const passedEnquiryId = params.enquiry_id ?? params.enquiryId ?? null;
  const passedCustomerId = params.customer_id ?? params.customerId ?? null;

  let quotation = null;
  if (existingId) {
    quotation = storageGet(`quotation.${existingId}`);
    if (!quotation) {
      container.innerHTML = `<p class="error">Quotation ${existingId} not found.</p>`;
      return;
    }
  } else {
    // New quotation must be linked to an enquiry
    if (!passedEnquiryId) {
      container.innerHTML = `
        <div class="card" style="max-width:480px;margin:48px auto;text-align:center">
          <h3 style="margin-bottom:12px">Enquiry Required</h3>
          <p style="color:var(--color-text-muted);margin-bottom:24px">
            Every quotation must be linked to an enquiry.<br>Please create an enquiry first.
          </p>
          <button class="btn btn-primary" id="btn-go-enquiry">+ Create Enquiry</button>
        </div>`;
      container.querySelector('#btn-go-enquiry').addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('ravasco:navigate', {
          detail: { view: 'enquiries', action: 'new', then_quote: true },
        }));
      });
      return;
    }
    const enquiry = storageGet(`enquiry.${passedEnquiryId}`);
    quotation = {
      enquiry_id:   passedEnquiryId,
      customer_id:  enquiry?.customer_id ?? passedCustomerId ?? null,
      location_id:  enquiry?.location_id ?? null,
      special_note: enquiry?.notes ?? null,
    };
  }
  if (isRevise && quotation) quotation = createRevision(quotation);

  _currentQuotation = quotation;
  _isReadOnly = isView || ['sent','revised','won','lost'].includes(quotation?.status);

  const line      = quotation?.lines?.[0] ?? {};
  const customers = getAllCustomerLocations();  // active only, flat per location
  const enquiries = storageGetAll('enquiry.');

  container.innerHTML = buildFormHTML({ quotation, isRevise, isView: _isReadOnly, line, customers, enquiries });
  populateAllDropdowns(container, line);
  setupEvents(container, quotation, isRevise);

  if (line.result) {
    _currentResult = line.result;
    renderResults(container, line.result);
  } else {
    // Recalc in all modes — view mode also needs _currentResult for PDF
    recalc(container);
  }
  if (_isReadOnly) lockForm(container);
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function buildFormHTML({ quotation, isRevise, isView, line, customers, enquiries }) {
  const q  = quotation ?? {};
  const ro = isView ? 'disabled' : '';

  const widthMm = line.width_mm ?? (line.width_id?.startsWith('W-MM-') ? parseInt(line.width_id.replace('W-MM-', ''), 10) : '');

  const _initFabricRow = (line.fabric_type && line.fabric_strength && line.plies)
    ? FABRIC_STRENGTH_MASTER.find(r =>
        r.fabric_type === line.fabric_type &&
        r.total_strength === Number(line.fabric_strength) &&
        r.no_of_ply === Number(line.plies))
    : null;
  const initCarcassMm = _initFabricRow?.nominal_carcass_thickness_mm ?? '';

  const titleText = !isRevise && !quotation ? 'New Quotation'
    : isRevise ? 'Revise Quotation'
    : isView   ? 'View Quotation'
    : 'Edit Quotation';

  return `
  <div class="costing-shell qf-shell">

    <!-- ── Topbar ─────────────────────────────────────────────── -->
    <div class="qf-topbar">
      <div class="qf-topbar-brand">
        <button class="btn btn-ghost" id="btn-back">← Back</button>
        <div class="qf-topbar-title">
          ${escHtml(titleText)}
          ${q.id     ? `<span class="qf-topbar-id">${escHtml(q.id)}</span>` : ''}
          ${q.status ? `<span class="badge badge-${q.status}">${q.status}</span>` : ''}
        </div>
      </div>
      <div class="qf-topbar-actions">
        ${!isView ? `<button class="btn btn-outline" id="btn-save">Save Draft</button>` : ''}
        ${!isView && q.status !== 'sent' ? `<button class="btn btn-primary" id="btn-send">Mark as Sent</button>` : ''}
        <button class="btn btn-outline" id="btn-pdf">↓ PDF</button>
        ${!isView ? `<button class="btn btn-outline" id="btn-approve">✉ Send for Approval</button>` : ''}
        ${isView && ['sent','revised','won','lost'].includes(q.status) ? `<button class="btn btn-outline" id="btn-email" style="margin-left:4px">✉ Email</button>` : ''}
        ${isView && (q.status === 'sent' || q.status === 'revised') ? `<button class="btn btn-outline" id="btn-revise-btn">Revise</button>` : ''}
        ${isView && q.status === 'sent' ? `
          <button class="btn btn-success" id="btn-won">WON</button>
          <button class="btn btn-danger-outline" id="btn-lost">LOST</button>` : ''}
      </div>
    </div>

    <!-- ── Phase Stepper ───────────────────────────────────────── -->
    <div class="qf-stepper">
      <button class="qf-step qf-step-active" data-qphase="1" type="button">
        <span class="qf-step-dot">1</span><span class="qf-step-lbl">Customer</span>
      </button>
      <button class="qf-step" data-qphase="2" type="button">
        <span class="qf-step-dot">2</span><span class="qf-step-lbl">Belt Build</span>
      </button>
      <button class="qf-step" data-qphase="3" type="button">
        <span class="qf-step-dot">3</span><span class="qf-step-lbl">Construction</span>
      </button>
      <button class="qf-step" data-qphase="4" type="button">
        <span class="qf-step-dot">4</span><span class="qf-step-lbl">Quantity</span>
      </button>
      <button class="qf-step" data-qphase="5" type="button">
        <span class="qf-step-dot">5</span><span class="qf-step-lbl">Commercial</span>
      </button>
    </div>

    <!-- ── Body ──────────────────────────────────────────────── -->
    <div class="qf-body">
      <div class="qf-left">

        <!-- ─── Phase 1 — Customer & Enquiry ─────────────────── -->
        <div class="qf-phase qf-phase-active" id="qf-ph-1">
          <div class="qf-phase-head" data-qph="1">
            <div class="qf-phase-title">
              <span class="qf-phase-num">1</span>Customer &amp; Enquiry
            </div>
            <span class="qf-phase-caret">▼</span>
          </div>
          <div class="qf-phase-body"><div class="qf-phase-inner">
            <div class="cf-row">
              <div class="cf-label">Customer *</div>
              <div class="cf-input"><div id="customer-combo"></div></div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Enquiry Ref</div>
              <div class="cf-input"><select name="enquiry_id" ${ro}></select></div>
            </div>
            <div class="cf-row" id="enq-desc-row"${q.enquiry_id ? '' : ' style="display:none"'}>
              <div class="cf-label">Description</div>
              <div class="cf-input"><span id="enq-desc-display" style="color:var(--color-text-muted);font-style:italic;padding:6px 0;display:block">${escHtml(enquiries.find(e => e.id === q.enquiry_id)?.subject ?? '')}</span></div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Special Note</div>
              <div class="cf-input">
                <input type="text" name="special_note" value="${escHtml(q.special_note ?? '')}" ${ro}>
              </div>
            </div>
          </div></div>
        </div>

        <!-- ─── Phase 2 — Belt Build ──────────────────────────── -->
        <div class="qf-phase" id="qf-ph-2">
          <div class="qf-phase-head" data-qph="2">
            <div class="qf-phase-title">
              <span class="qf-phase-num">2</span>Belt Build
            </div>
            <span class="qf-phase-caret">▼</span>
          </div>
          <div class="qf-phase-body"><div class="qf-phase-inner">
            <div class="cf-row">
              <div class="cf-label">Product Type</div>
              <div class="cf-input"><select name="product_type_id" ${ro}></select></div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Conveyor Type</div>
              <div class="cf-input"><select name="belt_type_id" ${ro}></select></div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Unit Type</div>
              <div class="cf-input">
                <div class="qf-unit-toggle" id="unit-toggle" data-val="${line.unit_system === 'imperial' ? 'imperial' : 'metric'}" ${ro ? 'data-ro="1"' : ''}>
                  <button type="button" class="qf-unit-opt${(line.unit_system ?? 'metric') === 'metric' ? ' on' : ''}" data-unit="metric">Metric</button>
                  <button type="button" class="qf-unit-opt${line.unit_system === 'imperial' ? ' on' : ''}" data-unit="imperial">Imperial</button>
                </div>
                <input type="hidden" name="unit_system" value="${line.unit_system === 'imperial' ? 'imperial' : 'metric'}">
              </div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Width <span class="cf-unit" id="width-unit-label">mm</span></div>
              <div class="cf-input">
                <div class="combobox-wrapper" id="width-combobox-wrapper">
                  <input type="number" id="width-input" name="width_mm" min="50" max="4000"
                         value="${widthMm}" placeholder="" autocomplete="off" ${ro}>
                  <div class="combobox-dropdown" id="width-dropdown"></div>
                  <input type="hidden" name="width_id" id="width-id-hidden" value="${escHtml(line.width_id ?? '')}">
                </div>
                <span id="width-custom-hint" class="cf-hint cf-warn" style="display:none">Custom width — Admin approval required</span>
              </div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Fabric Make</div>
              <div class="cf-input"><select name="fabric_make" ${ro}></select></div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Fabric Type</div>
              <div class="cf-input"><select name="fabric_type" ${ro}></select></div>
            </div>
            <div class="cf-row">
              <div class="cf-label cf-label-cust">Customer Fabric Type</div>
              <div class="cf-input"><select name="customer_fabric_type"></select></div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Fabric Strength</div>
              <div class="cf-input"><select name="fabric_strength" ${ro}></select></div>
            </div>
            <div class="cf-row">
              <div class="cf-label cf-label-cust">Customer Fabric Strength</div>
              <div class="cf-input"><select name="customer_fabric_strength"></select></div>
            </div>
            <div class="cf-row">
              <div class="cf-label">No. of Ply</div>
              <div class="cf-input"><select name="plies" ${ro}></select></div>
            </div>
            <div class="cf-row" id="carcass-master-row">
              <div class="cf-label">Carcass Thickness <span class="cf-unit">mm</span></div>
              <div class="cf-input">
                <div class="cf-auto-wrap">
                  <input type="text" id="carcass-master-input" readonly disabled value="${escHtml(String(initCarcassMm))}">
                  <span class="cf-auto-tag">AUTO</span>
                </div>
              </div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Customer Carcass <span class="cf-unit">mm</span></div>
              <div class="cf-input">
                <input type="number" name="customer_carcass_thickness_mm" min="0.1" step="0.1"
                       value="${escHtml(String(line.customer_carcass_thickness_mm ?? ''))}"
                       placeholder="Optional — overrides master" ${ro}>
              </div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Customer Total Belt Thk <span class="cf-unit">mm</span></div>
              <div class="cf-input cf-input-inline">
                <input type="number" name="customer_tbt_mm" min="0.1" step="0.1"
                       value="${escHtml(String(line.customer_tbt_mm ?? ''))}"
                       placeholder="Optional max — triggers warning if exceeded" ${ro}>
                <span class="cf-unit">mm</span>
              </div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Fabric GSM <span class="cf-unit">g/m²</span></div>
              <div class="cf-input cf-input-inline">
                <input type="number" name="ovr_fabric_gsm" min="1" step="1"
                       value="${escHtml(String(line.ovr_fabric_gsm ?? ''))}"
                       placeholder="Auto from fabric master" ${ro}>
                <span class="cf-unit">g/m²</span>
              </div>
            </div>
            <div id="spec-chips-panel" style="display:none">
              <div class="cf-chips-grid">
                <div class="cf-spec-chip"><div class="cf-spec-chip-lbl">Belt Rating</div><div class="cf-spec-chip-val" id="belt-rating-display">—</div></div>
                <div class="cf-spec-chip"><div class="cf-spec-chip-lbl">Carcass Thk · mm</div><div class="cf-spec-chip-val" id="carcass-thk-display">—</div></div>
                <div class="cf-spec-chip"><div class="cf-spec-chip-lbl">Fabric Style</div><div class="cf-spec-chip-val" id="fabric-style-type-display">—</div></div>
                <div class="cf-spec-chip"><div class="cf-spec-chip-lbl">Fabric GSM</div><div class="cf-spec-chip-val" id="fabric-gsm-display">—</div></div>
                <div class="cf-spec-chip"><div class="cf-spec-chip-lbl">Fabric Thk · mm/ply</div><div class="cf-spec-chip-val" id="fabric-thickness-display">—</div></div>
                <div class="cf-spec-chip"><div class="cf-spec-chip-lbl">Fabric Price · ₹/kg</div><div class="cf-spec-chip-val" id="fabric-price-display">—</div></div>
                <div class="cf-spec-chip"><div class="cf-spec-chip-lbl">Base Fabric</div><div class="cf-spec-chip-val" id="base-fabric-display">—</div></div>
                <div class="cf-spec-chip"><div class="cf-spec-chip-lbl">Total Belt Thk · mm</div><div class="cf-spec-chip-val" id="tbt-display">—</div></div>
              </div>
            </div>
            <input type="hidden" name="edge_id" value="${line.edge_id ?? 'EDGE-CE'}">
            <div class="cf-belt-desc-chip" id="belt-desc-panel" style="display:none">
              <div class="cf-spec-chip-lbl">Belt Description</div>
              <div class="cf-spec-chip-val" id="belt-desc-display">—</div>
            </div>
            <div class="cf-row" style="margin-top:8px">
              <div class="cf-label">Belt Construction Type</div>
              <div class="cf-input">
                <div class="qf-unit-toggle" id="end-type-toggle" data-val="${line.open_end_type === 'ENDLESS' ? 'ENDLESS' : 'OPEN_END'}" ${ro ? 'data-ro="1"' : ''}>
                  <button type="button" class="qf-unit-opt${line.open_end_type !== 'ENDLESS' ? ' on' : ''}" data-unit="OPEN_END">Open End</button>
                  <button type="button" class="qf-unit-opt${line.open_end_type === 'ENDLESS' ? ' on' : ''}" data-unit="ENDLESS">Endless</button>
                </div>
                <input type="hidden" name="open_end_type" value="${line.open_end_type === 'ENDLESS' ? 'ENDLESS' : 'OPEN_END'}">
              </div>
            </div>
            <div id="endless-length-row" style="display:${line.open_end_type === 'ENDLESS' ? 'block' : 'none'}">
              <div class="cf-row">
                <div class="cf-label">Length of Endless <span class="cf-unit">m</span></div>
                <div class="cf-input cf-input-inline">
                  <input type="number" name="endless_length_m" min="0.1" max="100" step="0.01"
                         value="${line.endless_length_m ?? ''}" placeholder="Max 100 m" ${ro}>
                  <span class="cf-unit">m</span>
                </div>
              </div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Belt Edge Type</div>
              <div class="cf-input">
                <div class="qf-unit-toggle" id="edge-type-toggle" data-val="${line.edge_id ?? 'EDGE-CE'}" ${ro ? 'data-ro="1"' : ''}>
                  <button type="button" class="qf-unit-opt${(line.edge_id ?? 'EDGE-CE') === 'EDGE-CE' ? ' on' : ''}" data-unit="EDGE-CE">Cut Edge</button>
                  <button type="button" class="qf-unit-opt${line.edge_id === 'EDGE-MD' ? ' on' : ''}" data-unit="EDGE-MD">Moulded</button>
                  <button type="button" class="qf-unit-opt${line.edge_id === 'EDGE-VL' ? ' on' : ''}" data-unit="EDGE-VL">Vulcanised</button>
                </div>
              </div>
            </div>
          </div></div>
        </div>

        <!-- ─── Phase 3 — Construction ────────────────────────── -->
        <div class="qf-phase" id="qf-ph-3">
          <div class="qf-phase-head" data-qph="3">
            <div class="qf-phase-title">
              <span class="qf-phase-num">3</span>Construction
            </div>
            <span class="qf-phase-caret">▼</span>
          </div>
          <div class="qf-phase-body"><div class="qf-phase-inner">
            <div class="qf-sub-h">Covers &amp; Skim</div>
            <div class="cf-row">
              <div class="cf-label">Grade Filter</div>
              <div class="cf-input">
                <div class="grade-chips" id="grade-chips-cover">
                  ${['ALL','GP','AR','HR','FR','OR','COLD','LRR'].map(g =>
                    `<button type="button" class="chip${g === 'ALL' ? ' active' : ''}" data-grade-filter="${g}">${g}</button>`
                  ).join('')}
                </div>
              </div>
            </div>
            <div class="cf-row">
              <div class="cf-label cf-label-cust">Customer Grade</div>
              <div class="cf-input"><select name="customer_grade"></select></div>
            </div>
            <div class="qf-cvr-tabs">
              <button class="qf-cvr-tab on" data-cvrtab="top"  type="button">Top Cover</button>
              <button class="qf-cvr-tab"    data-cvrtab="bot"  type="button">Bottom Cover</button>
              <button class="qf-cvr-tab"    data-cvrtab="skim" type="button">Skim</button>
            </div>
            <!-- Top cover -->
            <div class="qf-cvr-panel on" data-cvrpanel="top">
              <div class="cf-row">
                <div class="cf-label">Thickness <span class="cf-unit">mm</span></div>
                <div class="cf-input"><select name="top_cover_thickness_mm" ${ro}></select></div>
              </div>
              <div class="cf-row">
                <div class="cf-label">Compound</div>
                <div class="cf-input"><select name="top_cover_compound_id" ${ro}></select></div>
              </div>
              <div class="cf-row">
                <div class="cf-label">SG <span class="cf-unit">(auto)</span></div>
                <div class="cf-input"><input type="number" name="ovr_sg_top" step="0.001" min="0.5" max="3" value="${escHtml(String(line.ovr_sg_top ?? ''))}" placeholder="Auto" ${ro}></div>
              </div>
              <div class="cf-row">
                <div class="cf-label">Rate <span class="cf-unit">₹/kg</span></div>
                <div class="cf-input"><input type="number" name="ovr_cover_rate_top" step="0.01" min="0" value="${escHtml(String(line.ovr_cover_rate_top ?? ''))}" placeholder="auto from master" ${ro}></div>
              </div>
            </div>
            <!-- Bottom cover -->
            <div class="qf-cvr-panel" data-cvrpanel="bot">
              <div class="cf-row">
                <div class="cf-label">Thickness <span class="cf-unit">mm</span></div>
                <div class="cf-input"><select name="bottom_cover_thickness_mm" ${ro}></select></div>
              </div>
              <div class="cf-row">
                <div class="cf-label">Compound</div>
                <div class="cf-input"><select name="bottom_cover_compound_id" ${ro}></select></div>
              </div>
              <div class="cf-row">
                <div class="cf-label">SG <span class="cf-unit">(auto)</span></div>
                <div class="cf-input"><input type="number" name="ovr_sg_bottom" step="0.001" min="0.5" max="3" value="${escHtml(String(line.ovr_sg_bottom ?? ''))}" placeholder="Auto" ${ro}></div>
              </div>
              <div class="cf-row">
                <div class="cf-label">Rate <span class="cf-unit">₹/kg</span></div>
                <div class="cf-input"><input type="number" name="ovr_cover_rate_bottom" step="0.01" min="0" value="${escHtml(String(line.ovr_cover_rate_bottom ?? ''))}" placeholder="auto from master" ${ro}></div>
              </div>
            </div>
            <!-- Skim -->
            <div class="qf-cvr-panel" data-cvrpanel="skim">
              <div class="cf-row">
                <div class="cf-label">Skim Compound</div>
                <div class="cf-input">
                  <select name="skim_compound_id" ${ro}></select>
                  <span id="skim-auto-hint" class="cf-hint cf-info" style="display:none"></span>
                </div>
              </div>
              <div class="cf-row">
                <div class="cf-label">Skim Rate <span class="cf-unit">₹/kg</span></div>
                <div class="cf-input"><input type="number" name="ovr_skim_rate" step="0.01" min="0" value="${escHtml(String(line.ovr_skim_rate ?? ''))}" placeholder="auto from master" ${ro}></div>
              </div>
            </div>

            <div class="qf-sub-h" style="margin-top:16px">Breakers</div>
            <!-- BOT -->
            <div class="cf-row">
              <div class="cf-label">BOT (Breaker On Top)</div>
              <div class="cf-input">
                <div class="qf-unit-toggle qf-yn-toggle" data-target="breaker-top-sub" ${ro ? 'data-ro="1"' : ''}>
                  <button type="button" class="qf-unit-opt${line.breaker_top_id ? ' on' : ''}" data-unit="yes">Yes</button>
                  <button type="button" class="qf-unit-opt${!line.breaker_top_id ? ' on' : ''}" data-unit="no">No</button>
                </div>
                <input type="hidden" name="breaker_top_enabled" value="${line.breaker_top_id ? 'yes' : 'no'}">
              </div>
            </div>
            <div id="breaker-top-sub" class="cf-sub-block" style="display:${line.breaker_top_id ? 'block' : 'none'}">
              <div class="cf-row cf-indented">
                <div class="cf-label">Breaker Fabric</div>
                <div class="cf-input"><select name="breaker_top_id" ${ro}></select></div>
              </div>
              <div class="cf-row cf-indented">
                <div class="cf-label">No of Ply</div>
                <div class="cf-input">
                  <input type="number" name="breaker_top_ply" id="brk-top-ply-input" min="1" max="6" step="1"
                         value="${line.breaker_top_ply ?? ''}" placeholder="Auto from master" ${ro}>
                </div>
              </div>
              <div class="cf-row cf-indented">
                <div class="cf-label">GSM <span class="cf-unit">g/m²</span></div>
                <div class="cf-input cf-input-inline">
                  <input type="number" name="ovr_breaker_top_gsm" min="1" step="1"
                         value="${escHtml(String(line.ovr_breaker_top_gsm ?? ''))}"
                         placeholder="Auto from master" ${ro}>
                  <span class="cf-unit">g/m²</span>
                </div>
              </div>
              <div class="cf-row cf-indented">
                <div class="cf-label">Skim Type</div>
                <div class="cf-input"><select name="breaker_top_skim_compound_id" ${ro}></select></div>
              </div>
            </div>
            <!-- BOB -->
            <div class="cf-row">
              <div class="cf-label">BOB (Breaker On Bottom)</div>
              <div class="cf-input">
                <div class="qf-unit-toggle qf-yn-toggle" data-target="breaker-bot-sub" ${ro ? 'data-ro="1"' : ''}>
                  <button type="button" class="qf-unit-opt${line.breaker_bot_id ? ' on' : ''}" data-unit="yes">Yes</button>
                  <button type="button" class="qf-unit-opt${!line.breaker_bot_id ? ' on' : ''}" data-unit="no">No</button>
                </div>
                <input type="hidden" name="breaker_bot_enabled" value="${line.breaker_bot_id ? 'yes' : 'no'}">
              </div>
            </div>
            <div id="breaker-bot-sub" class="cf-sub-block" style="display:${line.breaker_bot_id ? 'block' : 'none'}">
              <div class="cf-row cf-indented">
                <div class="cf-label">Breaker Fabric</div>
                <div class="cf-input"><select name="breaker_bot_id" ${ro}></select></div>
              </div>
              <div class="cf-row cf-indented">
                <div class="cf-label">No of Ply</div>
                <div class="cf-input">
                  <input type="number" name="breaker_bot_ply" id="brk-bot-ply-input" min="1" max="6" step="1"
                         value="${line.breaker_bot_ply ?? ''}" placeholder="Auto from master" ${ro}>
                </div>
              </div>
              <div class="cf-row cf-indented">
                <div class="cf-label">GSM <span class="cf-unit">g/m²</span></div>
                <div class="cf-input cf-input-inline">
                  <input type="number" name="ovr_breaker_bot_gsm" min="1" step="1"
                         value="${escHtml(String(line.ovr_breaker_bot_gsm ?? ''))}"
                         placeholder="Auto from master" ${ro}>
                  <span class="cf-unit">g/m²</span>
                </div>
              </div>
              <div class="cf-row cf-indented">
                <div class="cf-label">Skim Type</div>
                <div class="cf-input"><select name="breaker_bot_skim_compound_id" ${ro}></select></div>
              </div>
            </div>

          </div></div>
        </div>

        <!-- ─── Phase 4 — Quantity ────────────────────────────── -->
        <div class="qf-phase" id="qf-ph-4">
          <div class="qf-phase-head" data-qph="4">
            <div class="qf-phase-title">
              <span class="qf-phase-num">4</span>Quantity
            </div>
            <span class="qf-phase-caret">▼</span>
          </div>
          <div class="qf-phase-body"><div class="qf-phase-inner">
            <div class="cf-row">
              <div class="cf-label">Length / Roll</div>
              <div class="cf-input cf-input-inline">
                <input type="number" name="length_per_roll_m" min="1" value="${line.length_per_roll_m ?? ''}" placeholder="" ${ro}>
                <span class="cf-unit">m / roll</span>
              </div>
            </div>
            <div class="cf-row">
              <div class="cf-label">No. of Rolls</div>
              <div class="cf-input">
                <input type="number" name="no_of_rolls" min="1" value="${line.no_of_rolls ?? 1}" placeholder="" ${ro}>
              </div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Total Length</div>
              <div class="cf-input cf-input-inline">
                <div class="cf-auto-wrap">
                  <input type="text" id="total-qty-display" readonly disabled
                         value="${line.length_per_roll_m && line.no_of_rolls ? (line.length_per_roll_m * line.no_of_rolls) : '—'}">
                  <span class="cf-auto-tag">AUTO</span>
                </div>
                <span class="cf-unit">m</span>
              </div>
            </div>
          </div></div>
        </div>

        <!-- ─── Phase 5 — Commercial ──────────────────────────── -->
        <div class="qf-phase" id="qf-ph-5">
          <div class="qf-phase-head" data-qph="5">
            <div class="qf-phase-title">
              <span class="qf-phase-num">5</span>Commercial
            </div>
            <span class="qf-phase-caret">▼</span>
          </div>
          <div class="qf-phase-body"><div class="qf-phase-inner">
            <div class="cf-row">
              <div class="cf-label">Cost of Production</div>
              <div class="cf-input cf-input-inline">
                <input type="number" name="cop_rate_per_kg" min="${GP_MASTER.override_bounds.cop_rate_per_kg.min}" max="${GP_MASTER.override_bounds.cop_rate_per_kg.max}" step="0.01"
                       value="${line.cop_rate_per_kg ?? ''}" placeholder="" ${ro}>
                <span class="cf-unit">₹ / kg</span>
              </div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Expense per KG</div>
              <div class="cf-input cf-input-inline">
                <input type="number" name="ovr_expenses_per_kg" step="0.01" min="${GP_MASTER.override_bounds.expenses_per_kg.min}" max="${GP_MASTER.override_bounds.expenses_per_kg.max}"
                       value="${escHtml(String(line.ovr_expenses_per_kg ?? GP_MASTER.expenses_per_kg_default))}" placeholder="${GP_MASTER.expenses_per_kg_default}" ${ro}>
                <span class="cf-unit">₹ / kg</span>
              </div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Reel Type</div>
              <div class="cf-input"><select name="reel_type_id" ${ro}></select></div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Packing Type</div>
              <div class="cf-input"><select name="packing_type_id" ${ro}></select></div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Reel Cost <span class="cf-unit">₹/m</span></div>
              <div class="cf-input cf-input-inline">
                <div class="cf-auto-wrap">
                  <input type="text" id="reel-cost-display" readonly disabled placeholder="—">
                  <span class="cf-auto-tag">AUTO</span>
                </div>
                <span class="cf-unit">₹ / m</span>
              </div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Packing Cost <span class="cf-unit">₹/m</span></div>
              <div class="cf-input cf-input-inline">
                <div class="cf-auto-wrap">
                  <input type="text" id="packing-cost-display" readonly disabled placeholder="—">
                  <span class="cf-auto-tag">AUTO</span>
                </div>
                <span class="cf-unit">₹ / m</span>
              </div>
            </div>

            <div class="cf-divider"></div>

            <div class="cf-row">
              <div class="cf-label">Freight Included</div>
              <div class="cf-input">
                <div class="qf-unit-toggle qf-yn-toggle" data-target="freight-fields" ${ro ? 'data-ro="1"' : ''}>
                  <button type="button" class="qf-unit-opt${line.freight_included !== 'no' ? ' on' : ''}" data-unit="yes">Yes</button>
                  <button type="button" class="qf-unit-opt${line.freight_included === 'no' ? ' on' : ''}" data-unit="no">No</button>
                </div>
                <input type="hidden" name="freight_included" value="${line.freight_included === 'no' ? 'no' : 'yes'}">
              </div>
            </div>
            <div id="freight-fields" style="display:${line.freight_included === 'no' ? 'none' : 'block'}">
              <div class="cf-row">
                <div class="cf-label">Destination</div>
                <div class="cf-input"><select name="freight_id" ${ro}></select></div>
              </div>
              <div class="cf-row">
                <div class="cf-label">Freight Rate <span class="cf-unit">₹/kg</span></div>
                <div class="cf-input cf-input-inline">
                  <input type="number" name="freight_cost_override" id="freight-cost-input"
                         step="0.01" min="0" value="${line.freight_cost_override ?? ''}"
                         placeholder="Enter ₹ per kg" ${ro}>
                  <span class="cf-unit">₹ / kg</span>
                </div>
              </div>
              <div class="cf-row" style="display:none">
                <div class="cf-label">Cost Type</div>
                <div class="cf-input">
                  <select name="freight_cost_type" ${ro}>
                    <option value="KG"    ${(line.freight_cost_type ?? 'KG') === 'KG'    ? 'selected' : ''}>KG (per kg)</option>
                    <option value="RM"    ${line.freight_cost_type === 'RM'    ? 'selected' : ''}>RM (per metre)</option>
                    <option value="SQMTR" ${line.freight_cost_type === 'SQMTR' ? 'selected' : ''}>SQ MTR (per m²)</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="cf-divider"></div>

            <div class="cf-row">
              <div class="cf-label">GP %</div>
              <div class="cf-input cf-input-inline">
                <input type="number" name="gp_pct_direct" min="0" max="100" step="0.1"
                       value="${line.gp_pct_direct ?? 20}" ${ro}>
                <span class="cf-unit">%</span>
              </div>
            </div>
            <div id="gp-low-warning" style="display:${(line.gp_pct_direct != null && line.gp_pct_direct < 20) ? 'flex' : 'none'}; align-items:flex-start; gap:8px; background:#fffbeb; border:1px solid var(--y-400); border-left:4px solid var(--y-700); border-radius:6px; padding:10px 14px; margin:4px 0 8px; font-size:12px; color:var(--y-900);">
              <span style="font-size:14px;line-height:1.2">⚠</span>
              <span>GP% is below the minimum of <strong>20%</strong>. This has been overridden with approval.</span>
            </div>
            <div class="cf-row">
              <div class="cf-label">Currency</div>
              <div class="cf-input"><select name="currency_id" ${ro}></select></div>
            </div>
            <div class="cf-row">
              <div class="cf-label">Exchange Rate <span id="cf-exrate-unit" class="cf-unit">₹ / unit</span></div>
              <div class="cf-input cf-input-inline">
                <input type="number" name="exchange_rate" step="0.0001" min="0"
                       value="${line.exchange_rate ?? 1}" ${ro}>
                <span class="cf-unit">₹</span>
              </div>
            </div>

            <div class="cf-divider"></div>

            <div class="qf-sub-h">Discount</div>
            <div class="cf-row">
              <div class="cf-label">Apply Discount</div>
              <div class="cf-input">
                <div class="qf-unit-toggle qf-yn-toggle" data-target="discount-fields" ${ro ? 'data-ro="1"' : ''}>
                  <button type="button" class="qf-unit-opt${(line.discount_pct ?? 0) > 0 ? ' on' : ''}" data-unit="yes">Yes</button>
                  <button type="button" class="qf-unit-opt${(line.discount_pct ?? 0) === 0 ? ' on' : ''}" data-unit="no">No</button>
                </div>
                <input type="hidden" name="discount_enabled" value="${(line.discount_pct ?? 0) > 0 ? 'yes' : 'no'}">
              </div>
            </div>
            <div id="discount-fields" style="display:${(line.discount_pct ?? 0) > 0 ? 'block' : 'none'}">
              <div class="cf-row">
                <div class="cf-label">Price Type</div>
                <div class="cf-input">
                  <select name="discount_price_type" ${ro}>
                    <option value="CD" ${(line.discount_price_type ?? 'CD') === 'CD' ? 'selected' : ''}>CD (Standard)</option>
                    <option value="VD" ${line.discount_price_type === 'VD' ? 'selected' : ''}>VD</option>
                  </select>
                </div>
              </div>
              <div class="cf-row">
                <div class="cf-label">Discount %</div>
                <div class="cf-input cf-input-inline">
                  <input type="number" name="discount_pct_input" min="0" max="100" step="0.1"
                         value="${((line.discount_pct ?? 0) * 100).toFixed(1)}" ${ro}>
                  <span class="cf-unit">%</span>
                </div>
              </div>
            </div>

            <div class="cf-divider"></div>

            <div id="overrides-section">
              <div class="cf-section-title cf-collapsible-title" id="overrides-toggle" style="cursor:pointer">
                <span>Rate Overrides</span>
                <span class="cf-toggle-icon" id="overrides-caret">▶</span>
              </div>
              <div id="overrides-body" style="display:none">
                <p class="cf-hint" style="margin-bottom:.75rem">Leave blank to use master rates.</p>
                <div class="cf-row">
                  <div class="cf-label">Fabric Price <span class="cf-unit">₹/kg</span></div>
                  <div class="cf-input"><input type="number" name="ovr_fabric_price" step="0.01" min="0" value="${escHtml(String(line.ovr_fabric_price ?? ''))}" placeholder="Auto from fabric master" ${ro}></div>
                </div>
              </div>
            </div>

          </div></div>
        </div>

      </div><!-- /qf-left -->

      <!-- ── Results Panel ──────────────────────────────────── -->
      <div class="qf-right">
        <div id="results-empty-state" class="qf-rail-empty">Fill in the form to see live calculations.</div>
        <div id="results-warnings"></div>

        <!-- KPI Hero Strip -->
        <div class="ro-kpi-strip">
          <div class="ro-kpi ro-kpi-hero">
            <div class="ro-kpi-lbl">Selling Price / m</div>
            <div class="ro-kpi-val" id="rs-price">—</div>
          </div>
          <div class="ro-kpi ro-kpi-hero ro-kpi-vd">
            <div class="ro-kpi-lbl">VD Price / m</div>
            <div class="ro-kpi-val" id="rs-vd-price">—</div>
          </div>
          <div class="ro-kpi">
            <div class="ro-kpi-lbl">RMC / m</div>
            <div class="ro-kpi-val" id="rs-rmc">—</div>
          </div>
          <div class="ro-kpi">
            <div class="ro-kpi-lbl">Belt Weight / m</div>
            <div class="ro-kpi-val" id="rs-total-wt">—</div>
          </div>
          <div class="ro-kpi">
            <div class="ro-kpi-lbl">Total Length</div>
            <div class="ro-kpi-val" id="r-total-length">—</div>
          </div>
        </div>

        <!-- Block 1 — Belt Specification (input summary chips) -->
        <div class="ro-block">
          <div class="ro-block-hd">Belt Specification</div>
          <div class="ro-chips">
            <div class="ro-chip"><span class="ro-chip-lbl">Width</span><span class="ro-chip-val" id="ri-width">—</span></div>
            <div class="ro-chip"><span class="ro-chip-lbl">Fabric Type</span><span class="ro-chip-val" id="ri-fabric-type">—</span></div>
            <div class="ro-chip"><span class="ro-chip-lbl">Belt Rating</span><span class="ro-chip-val" id="ri-rating">—</span></div>
            <div class="ro-chip"><span class="ro-chip-lbl">No of Ply</span><span class="ro-chip-val" id="ri-plies">—</span></div>
            <div class="ro-chip"><span class="ro-chip-lbl">Top Cover</span><span class="ro-chip-val" id="ri-top">—</span></div>
            <div class="ro-chip"><span class="ro-chip-lbl">Bottom Cover</span><span class="ro-chip-val" id="ri-bot">—</span></div>
            <div class="ro-chip ro-chip-wide"><span class="ro-chip-lbl">Grade</span><span class="ro-chip-val" id="ri-grade">—</span></div>
          </div>
        </div>

        <!-- Block 2 — Weight Calculations -->
        <div class="ro-block">
          <div class="ro-block-hd">Weight Calculations</div>
          <table class="ro-table">
            <thead><tr><th>Component</th><th>per / m</th><th>Total kg</th></tr></thead>
            <tbody>
              <tr><td>Fabric</td><td id="rw-fabric-pm">—</td><td id="rw-fabric-kg">—</td></tr>
              <tr><td>Top Cover</td><td id="rw-top-pm">—</td><td id="rw-top-kg">—</td></tr>
              <tr><td>Bottom Cover</td><td id="rw-bot-pm">—</td><td id="rw-bot-kg">—</td></tr>
              <tr><td>Skim</td><td id="rw-skim-pm">—</td><td id="rw-skim-kg">—</td></tr>
              <tr class="ro-subtotal"><td>Fabric Compound <span class="ro-note">(T+B+S)</span></td><td id="rw-compound-pm">—</td><td id="rw-compound-kg">—</td></tr>
              <tr id="rw-bot-row" style="display:none"><td>BOT</td><td id="rw-bot-brk-pm">—</td><td id="rw-bot-brk-kg">—</td></tr>
              <tr id="rw-bob-row" style="display:none"><td>BOB</td><td id="rw-bob-brk-pm">—</td><td id="rw-bob-brk-kg">—</td></tr>
              <tr class="ro-total"><td><strong>Total Calculated</strong></td><td id="rw-calc-pm">—</td><td id="rw-calc-kg">—</td></tr>
              <tr class="ro-total ro-actual"><td><strong>Total Actual</strong><span class="ro-note"> (no wastage)</span></td><td id="rw-actual-pm">—</td><td id="rw-actual-kg">—</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Block 3 — Costing -->
        <div class="ro-block">
          <div class="ro-block-hd">Costing</div>
          <table class="ro-table">
            <thead><tr><th>Component</th><th>₹ / m</th><th>Total ₹</th></tr></thead>
            <tbody>
              <tr><td>Fabric</td><td id="rc-fabric-pm">—</td><td id="rc-fabric-tot">—</td></tr>
              <tr><td>Top Cover</td><td id="rc-top-pm">—</td><td id="rc-top-tot">—</td></tr>
              <tr><td>Bottom Cover</td><td id="rc-bot-pm">—</td><td id="rc-bot-tot">—</td></tr>
              <tr><td>Skim</td><td id="rc-skim-pm">—</td><td id="rc-skim-tot">—</td></tr>
              <tr class="ro-subtotal"><td>Fabric Compound <span class="ro-note">(T+B+S)</span></td><td id="rc-compound-pm">—</td><td id="rc-compound-tot">—</td></tr>
              <tr id="rc-bot-row" style="display:none"><td>BOT</td><td id="rc-bot-brk-pm">—</td><td id="rc-bot-brk-tot">—</td></tr>
              <tr id="rc-bob-row" style="display:none"><td>BOB</td><td id="rc-bob-brk-pm">—</td><td id="rc-bob-brk-tot">—</td></tr>
              <tr class="ro-total"><td><strong>Total Calculated</strong></td><td id="rc-calc-pm">—</td><td id="rc-calc-tot">—</td></tr>
              <tr class="ro-total ro-actual"><td><strong>Total Actual</strong><span class="ro-note"> (no wastage)</span></td><td id="rc-actual-pm">—</td><td id="rc-actual-tot">—</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Block 4 — Pricing -->
        <div class="ro-block">
          <div class="ro-block-hd">Pricing</div>
          <table class="ro-table ro-table-4col">
            <thead><tr><th>Item</th><th>₹ / m</th><th>₹ / kg</th><th>Total ₹</th></tr></thead>
            <tbody>
              <tr><td>Total Cost / m <span class="ro-note">(mat + COP + exp + crate + freight)</span></td><td id="rp-rmc-pm">—</td><td id="rp-rmc-kg">—</td><td id="rp-rmc-tot">—</td></tr>
              <tr><td>Material Cost / m <span class="ro-note">(fabric + rubber only)</span></td><td id="rp-rmcvd-pm">—</td><td id="rp-rmcvd-kg">—</td><td id="rp-rmcvd-tot">—</td></tr>
              <tr class="ro-subtotal"><td>CD Price / m <span class="ro-note">(GP% on full cost)</span></td><td id="rp-rmcgp-pm">—</td><td id="rp-rmcgp-kg">—</td><td id="rp-rmcgp-tot">—</td></tr>
              <tr class="ro-subtotal"><td>VD Price / m <span class="ro-note">(GP% on material only)</span></td><td id="rp-rmcvdgp-pm">—</td><td id="rp-rmcvdgp-kg">—</td><td id="rp-rmcvdgp-tot">—</td></tr>
              <tr><td>Crate Cost</td><td id="rp-crate-pm">—</td><td id="rp-crate-kg">—</td><td id="rp-crate-tot">—</td></tr>
              <tr id="rp-reel-row"><td>Reel Cost</td><td id="rp-reel-pm">—</td><td id="rp-reel-kg">—</td><td id="rp-reel-tot">—</td></tr>
              <tr id="rp-freight-row"><td>Freight Cost</td><td id="rp-freight-pm">—</td><td id="rp-freight-kg">—</td><td id="rp-freight-tot">—</td></tr>
              <tr class="ro-total"><td><strong>Total Material Cost</strong></td><td colspan="2" id="rp-total-rmcvd-pm">—</td><td id="rp-total-rmcvd">—</td></tr>
              <tr class="ro-total ro-hero-row"><td><strong>Total VD Quotation</strong></td><td colspan="2" id="rp-total-quot-pm">—</td><td id="rp-total-quot-vd">—</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Skim compatibility (hidden, populated for warnings) -->
        <div id="skim-match-card" class="ro-block ro-block-skim" style="display:none">
          <div class="ro-block-hd ro-block-hd-warn">Skim ↔ Cover Compatibility</div>
          <div class="ro-chips ro-chips-2">
            <div class="ro-chip"><span class="ro-chip-lbl">Cover Grade</span><span class="ro-chip-val" id="skim-match-grade-family">—</span></div>
            <div class="ro-chip"><span class="ro-chip-lbl">Skim Grade</span><span class="ro-chip-val" id="skim-match-skim-family">—</span></div>
            <div class="ro-chip"><span class="ro-chip-lbl">Recommended</span><span class="ro-chip-val" id="skim-match-recommended">—</span></div>
            <div class="ro-chip ro-chip-wide"><span class="ro-chip-lbl">Status</span><span class="ro-chip-val" id="skim-match-status">—</span></div>
          </div>
        </div>

        <!-- Final price / discount input (preserved for pricing logic) -->
        <div class="ro-block">
          <div class="ro-block-hd">Final Price</div>
          <div class="ro-chips">
            <div class="ro-chip ro-chip-wide">
              <span class="ro-chip-lbl">Final Price / m</span>
              <span class="ro-chip-val" id="r-final-per-m">—</span>
            </div>
            <div class="ro-chip ro-chip-wide">
              <span class="ro-chip-lbl">Final Price Total</span>
              <span class="ro-chip-val" id="r-final-total">—</span>
            </div>
            <div class="ro-chip ro-chip-wide ro-chip-input">
              <span class="ro-chip-lbl">Custom Final Price / m</span>
              <input type="number" name="custom_final_price_per_m" step="1"
                     value="${line.custom_final_price_per_m ?? ''}" placeholder="—" ${ro}
                     class="ro-chip-input-field">
            </div>
          </div>
        </div>

        <!-- Hidden legacy IDs required by renderDetailedFields / updateDiscountResults -->
        <span id="r-w-eff"         style="display:none">—</span>
        <span id="r-l-eff"         style="display:none">—</span>
        <span id="r-width-factor"  style="display:none">—</span>
        <span id="r-length-factor" style="display:none">—</span>
        <span id="r-tbt"           style="display:none">—</span>
        <span id="r-actual-wt-per-m" style="display:none">—</span>
        <span id="r-wt-per-m"      style="display:none">—</span>
        <span id="r-compound-gsm"  style="display:none">—</span>
        <span id="r-actual-wt-m"   style="display:none">—</span>
        <span id="r-calc-wt-per-m" style="display:none">—</span>
        <span id="r-total-actual-wt" style="display:none">—</span>
        <span id="r-total-calc-wt" style="display:none">—</span>
        <span id="r-cover-top-val" style="display:none">—</span>
        <span id="r-cover-top-per-m" style="display:none">—</span>
        <span id="r-cover-bot-val" style="display:none">—</span>
        <span id="r-cover-bot-per-m" style="display:none">—</span>
        <span id="r-cover-val"     style="display:none">—</span>
        <span id="r-cover-per-m"   style="display:none">—</span>
        <span id="r-compound-val"  style="display:none">—</span>
        <span id="r-compound-per-m" style="display:none">—</span>
        <span id="r-fabric-val"    style="display:none">—</span>
        <span id="r-fabric-per-m"  style="display:none">—</span>
        <span id="r-skim-val"      style="display:none">—</span>
        <span id="r-skim-per-m"    style="display:none">—</span>
        <span id="r-no-brk-val"    style="display:none">—</span>
        <span id="r-no-brk-per-m"  style="display:none">—</span>
        <span id="r-brk1-val"      style="display:none">—</span>
        <span id="r-brk1-per-m"    style="display:none">—</span>
        <span id="r-brk1-skim-val" style="display:none">—</span>
        <span id="r-brk1-skim-per-m" style="display:none">—</span>
        <span id="r-brk2-val"      style="display:none">—</span>
        <span id="r-brk2-per-m"    style="display:none">—</span>
        <span id="r-brk2-skim-val" style="display:none">—</span>
        <span id="r-brk2-skim-per-m" style="display:none">—</span>
        <span id="r-total-wt"      style="display:none">—</span>
        <span id="r-cover-cost"    style="display:none">—</span>
        <span id="r-cover-cost-per-m" style="display:none">—</span>
        <span id="r-fabric-cost"   style="display:none">—</span>
        <span id="r-fabric-cost-per-m" style="display:none">—</span>
        <span id="r-skim-cost"     style="display:none">—</span>
        <span id="r-skim-cost-per-m" style="display:none">—</span>
        <span id="r-compound-cost-val" style="display:none">—</span>
        <span id="r-compound-cost-per-m" style="display:none">—</span>
        <span id="r-cop-cost"      style="display:none">—</span>
        <span id="r-expenses-cost" style="display:none">—</span>
        <span id="r-packing-cost"  style="display:none">—</span>
        <span id="r-freight-cost"  style="display:none">—</span>
        <span id="r-freight-cost-per-m" style="display:none">—</span>
        <span id="r-total-cost"    style="display:none">—</span>
        <span id="r-price-per-kg"  style="display:none">—</span>
        <span id="r-brk1-cost"     style="display:none">—</span>
        <span id="r-brk1-skim-cost" style="display:none">—</span>
        <span id="r-brk2-cost"     style="display:none">—</span>
        <span id="r-brk2-skim-cost" style="display:none">—</span>
        <span id="r-rmc"           style="display:none">—</span>
        <span id="r-gp"            style="display:none">—</span>
        <span id="r-gp-vd"         style="display:none">—</span>
        <span id="r-cd-total"      style="display:none">—</span>
        <span id="r-cd-per-m"      style="display:none">—</span>
        <span id="r-vd-total"      style="display:none">—</span>
        <span id="r-vd-per-m"      style="display:none">—</span>
        <span id="r-cd-per-mm"     style="display:none">—</span>
        <span id="r-vd-per-mm"     style="display:none">—</span>
        <span id="r-rmc-with-gp"   style="display:none">—</span>
        <span id="r-min-quot-rmc"  style="display:none">—</span>
        <span id="r-per-mm-running" style="display:none">—</span>
        <span id="r-total-rmc-amount" style="display:none">—</span>
        <span id="r-total-rmc-vd"  style="display:none">—</span>
        <span id="r-rmc-usd"       style="display:none">—</span>
        <span id="r-cd-usd"        style="display:none">—</span>
        <span id="r-brk1"          style="display:none">—</span>
        <span id="r-brk1-skim"     style="display:none">—</span>
        <span id="r-brk2"          style="display:none">—</span>
        <span id="r-brk2-skim"     style="display:none">—</span>
        <span id="r-brk1-cost-row" style="display:none">—</span>
        <span id="r-brk1-skim-cost-row" style="display:none">—</span>
        <span id="r-brk2-cost-row" style="display:none">—</span>
        <span id="r-brk2-skim-cost-row" style="display:none">—</span>
        <span id="r-expenses-row"  style="display:none">—</span>
        <div id="detailed-fields"  style="display:none"></div>
        <div id="cc-breakdown-panel" style="display:none">
          <span id="cc-width">—</span><span id="cc-length">—</span><span id="cc-belt-wt">—</span>
          <span id="cc-len-per-ply">—</span><span id="cc-fab-gsm">—</span><span id="cc-fab-price">—</span>
          <span id="cc-fab-weight">—</span><span id="cc-fab-cost">—</span><span id="cc-brk-length">—</span>
          <span id="cc-cmpd-wt">—</span><span id="cc-total-cover-wt">—</span><span id="cc-skim-wt">—</span>
          <span id="cc-cover-cost">—</span><span id="cc-skim-cost-chip">—</span><span id="cc-total-cmpd-cost">—</span>
          <span id="cc-fab-brk-cost">—</span><span id="cc-min-price">—</span>
          <span id="cc-brk-group">—</span>
          <span id="cc-bot-chip">—</span><span id="cc-bot-gsm">—</span><span id="cc-bot-price-chip">—</span>
          <span id="cc-bot-price">—</span><span id="cc-bot-wt-chip">—</span><span id="cc-bot-fab-wt">—</span>
          <span id="cc-bob-chip">—</span><span id="cc-bob-gsm">—</span><span id="cc-bob-price-chip">—</span>
          <span id="cc-bob-price">—</span><span id="cc-bob-wt-chip">—</span><span id="cc-bob-fab-wt">—</span>
        </div>

      </div><!-- /qf-right -->
    </div><!-- /qf-body -->

  </div><!-- /qf-shell -->

  <!-- Custom width modal -->
  <div id="custom-width-modal" class="modal" style="display:none">
    <div class="modal-box">
      <h3>Request Custom Width</h3>
      <p>Custom widths require Admin approval before this quotation can be sent.</p>
      <div class="form-group">
        <label>Width (mm) *</label>
        <input type="number" id="custom-width-input" min="50" max="4000" placeholder="">
      </div>
      <div class="form-group">
        <label>Justification</label>
        <input type="text" id="custom-width-note" placeholder="Customer requirement…">
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="btn-submit-custom-width">Submit Request</button>
        <button class="btn btn-ghost"   id="btn-cancel-custom-width">Cancel</button>
      </div>
    </div>
  </div>
  `;
}

// ─── Populate dropdowns ────────────────────────────────────────────────────────

function populateAllDropdowns(container, line) {
  const q = _currentQuotation ?? {};
  const customers = getAllCustomerLocations();  // active only, flat per location
  const enquiries = storageGetAll('enquiry.');

  if (!q.customer_id && q.enquiry_id) {
    const enquiry = enquiries.find(e => e.id === q.enquiry_id);
    if (enquiry) {
      q.customer_id  = enquiry.customer_id;
      q.location_id  = enquiry.location_id ?? null;
    }
  }

  const selectedCustomer = q.customer_id || null;
  const filteredEnquiries = selectedCustomer
    ? enquiries.filter(enq => enq.customer_id === selectedCustomer)
    : enquiries;

  const customerOptionKey = selectedCustomer
    ? (q.location_id ? `${selectedCustomer}|${q.location_id}` : selectedCustomer)
    : null;
  mountCombobox({
    container: container.querySelector('#customer-combo'),
    name: 'customer_id',
    items: customers.map(c => ({ value: c.option_key, label: c.name })),
    selected: customerOptionKey,
    placeholder: 'Search customer…',
    disabled: _isReadOnly,
  });
  pop(container, '[name="enquiry_id"]',  filteredEnquiries, 'id', 'id',   q.enquiry_id, true);

  // Product Type
  pop(container, '[name="product_type_id"]', PRODUCT_MASTER.filter(r => r.active), 'id', 'name', line.product_type_id);

  // Conveyor Type — filtered to CB (Conveyor Belt) by default, re-filtered on product change
  populateBeltTypes(container, line.product_type_id, line.belt_type_id);

  pop(container, '[name="fabric_make"]', FABRIC_SUPPLIER_MASTER, 'code', 'name', line.fabric_make);

  pop(container, '[name="fabric_type"]', FABRIC_TYPE_MASTER.filter(r => r.active), 'code', 'name', line.fabric_type);
  pop(container, '[name="customer_fabric_type"]', FABRIC_TYPE_MASTER.filter(r => r.active), 'code', 'name', line.customer_fabric_type);

  pop(container, '[name="customer_grade"]', GRADE_MASTER.filter(r => r.active), 'code', 'name', line.customer_grade);

  populateFabricStrengthDropdowns(container, line.fabric_type, line.fabric_strength, line.plies, line.customer_fabric_strength);

  pop(container, '[name="top_cover_thickness_mm"]',    COVER_THICKNESS_MASTER.filter(r => r.active), 'thickness_mm', 'display', line.top_cover_thickness_mm);
  pop(container, '[name="bottom_cover_thickness_mm"]', COVER_THICKNESS_MASTER.filter(r => r.active), 'thickness_mm', 'display', line.bottom_cover_thickness_mm);

  // Live master data (includes admin localStorage overrides)
  const _COMPOUND      = getLiveCompounds();
  const _BREAKER       = getLiveBreakers();
  const _PACKING       = getLivePacking();
  const _FREIGHT       = getLiveFreight();
  const _EDGE          = getLiveEdges();

  // Cover compounds — role check via split (roles is a pipe-separated string)
  const isCoverRole = r => { const rs = r.roles?.split('|') ?? []; return rs.includes('TOP_COVER') || rs.includes('BOTTOM_COVER'); };
  const isSkimRole  = r => (r.roles?.split('|') ?? []).includes('SKIM');
  const allCover    = _COMPOUND.filter(r => r.active !== false && isCoverRole(r));
  const coverCmpds  = _gradeFilter === 'ALL' ? allCover : allCover.filter(r => r.grade_family === _gradeFilter);
  pop(container, '[name="top_cover_compound_id"]',    coverCmpds, 'id', 'name', line.top_cover_compound_id ?? line.grade_id);
  pop(container, '[name="bottom_cover_compound_id"]', coverCmpds, 'id', 'name', line.bottom_cover_compound_id ?? line.grade_id);

  // Skim compounds (fabric skim + breaker skims) — not grade-filtered
  const skimCmpds = _COMPOUND.filter(r => r.active !== false && isSkimRole(r));
  pop(container, '[name="skim_compound_id"]',             skimCmpds, 'id', 'name', line.skim_compound_id);
  pop(container, '[name="breaker_top_skim_compound_id"]', skimCmpds, 'id', 'name', line.breaker_top_skim_compound_id);
  pop(container, '[name="breaker_bot_skim_compound_id"]', skimCmpds, 'id', 'name', line.breaker_bot_skim_compound_id);

  // Breaker fabric selects
  const activeBrk = _BREAKER.filter(r => r.active !== false);
  pop(container, '[name="breaker_top_id"]', activeBrk, 'id', 'name', line.breaker_top_id);
  pop(container, '[name="breaker_bot_id"]', activeBrk, 'id', 'name', line.breaker_bot_id);

  // Edge type — sync hidden input + toggle buttons
  const _edgeVal = line.edge_id ?? 'EDGE-CE';
  const _edgeHidden = container.querySelector('[name="edge_id"]');
  if (_edgeHidden) _edgeHidden.value = _edgeVal;
  container.querySelectorAll('#edge-type-toggle .qf-unit-opt').forEach(b => b.classList.toggle('on', b.dataset.unit === _edgeVal));

  // Packing — split by applies_to
  const reelOpts    = _PACKING.filter(r => (r.applies_to === 'reel'    || r.applies_to === 'both') && r.active !== false);
  const packingOpts = _PACKING.filter(r => (r.applies_to === 'packing' || r.applies_to === 'both') && r.active !== false);
  pop(container, '[name="reel_type_id"]',    reelOpts,    'id', 'name', line.reel_type_id);
  pop(container, '[name="packing_type_id"]', packingOpts, 'id', 'name', line.packing_type_id);

  pop(container, '[name="freight_id"]', _FREIGHT.filter(r => r.active !== false), 'id', 'state_name', line.freight_id);

  // Currency — default to INR
  initCurrencyDefaults();
  const currencies = getAllCurrencies().map(c => ({ ...c, _label: `${c.code} — ${c.name}` }));
  const inrId = currencies.find(c => c.code === 'INR')?.id ?? null;
  const selCurrencyId = line.currency_id ?? inrId;
  pop(container, '[name="currency_id"]', currencies, 'id', '_label', selCurrencyId);
  _updateExchangeRateUnit(container, currencies, selCurrencyId);

  updateDerivedDisplays(container, line);
  updateBeltRating(container);
  autoFillRateFields(container);
  autoFillCopRate(container);
}

function populateBeltTypes(container, productTypeId, selectedId) {
  const productCode = PRODUCT_MASTER.find(r => r.id === productTypeId)?.code ?? 'CB';
  const types = BELT_TYPE_MASTER.filter(r => r.product_type_code === productCode && r.phase === 1 && r.active);
  pop(container, '[name="belt_type_id"]', types, 'id', 'name', selectedId);
}

function populateFabricStrengthDropdowns(container, fabricType, selStrength, selPlies, selCustStrength) {
  const rows = fabricType
    ? FABRIC_STRENGTH_MASTER.filter(r => r.fabric_type === fabricType && r.active)
    : FABRIC_STRENGTH_MASTER.filter(r => r.active);

  const strengths = [...new Set(rows.map(r => r.total_strength))].sort((a, b) => a - b);
  const pliesSet  = [...new Set(rows.map(r => r.no_of_ply))].sort((a, b) => a - b);

  const sEl = container.querySelector('[name="fabric_strength"]');
  sEl.innerHTML = '<option value="">— select —</option>';
  strengths.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s + ' N/mm';
    if (s === selStrength) o.selected = true;
    sEl.appendChild(o);
  });

  const pEl = container.querySelector('[name="plies"]');
  pEl.innerHTML = '<option value="">— select —</option>';
  pliesSet.forEach(p => {
    const o = document.createElement('option');
    o.value = p; o.textContent = p + (p === 1 ? ' ply' : ' plies');
    if (p === selPlies) o.selected = true;
    pEl.appendChild(o);
  });

  const csEl = container.querySelector('[name="customer_fabric_strength"]');
  if (csEl) {
    csEl.innerHTML = '<option value="">— select —</option>';
    strengths.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s + ' N/mm';
      if (s === selCustStrength) o.selected = true;
      csEl.appendChild(o);
    });
  }
}

// Utility wrapper around populateDropdown pattern
function pop(container, sel, master, valueField, labelField, selected, includeBlank = false, blankLabel = '— select —') {
  const el = container.querySelector(sel);
  if (!el) return;
  el.innerHTML = includeBlank ? `<option value="">${blankLabel}</option>` : '<option value="">— select —</option>';
  master.forEach(row => {
    const o = document.createElement('option');
    o.value       = row[valueField] ?? '';
    o.textContent = row[labelField] ?? '';
    if (String(row[valueField]) === String(selected)) o.selected = true;
    el.appendChild(o);
  });
}

// ─── Currency unit label helper ───────────────────────────────────────────────

function _updateExchangeRateUnit(container, currencies, selectedId) {
  const cur   = currencies.find(c => c.id === selectedId);
  const label = cur ? `₹ / ${cur.code}` : '₹ / unit';
  const el    = container.querySelector('#cf-exrate-unit');
  if (el) el.textContent = label;
}

// ─── Enquiry description display ──────────────────────────────────────────────

function updateEnquiryDescription(container, enquiryId) {
  const enq     = enquiryId ? storageGet(`enquiry.${enquiryId}`) : null;
  const descRow = container.querySelector('#enq-desc-row');
  const descEl  = container.querySelector('#enq-desc-display');
  if (descRow) descRow.style.display = enq?.subject ? '' : 'none';
  if (descEl)  descEl.textContent    = enq?.subject ?? '';
}

// ─── Auto-fill SG + rate fields from selected compound ────────────────────────

function autoFillRateFields(container, overwrite = false) {
  const _CMPD = getLiveCompounds();
  const fill = (name, value) => {
    const el = container.querySelector(`[name="${name}"]`);
    if (el && (overwrite || !el.value) && value != null) el.value = value;
  };
  const topId  = container.querySelector('[name="top_cover_compound_id"]')?.value;
  const botId  = container.querySelector('[name="bottom_cover_compound_id"]')?.value;
  const skimId = container.querySelector('[name="skim_compound_id"]')?.value;
  const topCmpd  = topId  ? _CMPD.find(r => r.id === topId)  : null;
  const botCmpd  = botId  ? _CMPD.find(r => r.id === botId)  : null;
  const skimCmpd = skimId ? _CMPD.find(r => r.id === skimId) : null;
  fill('ovr_sg_top',            topCmpd?.sg);
  fill('ovr_cover_rate_top',    topCmpd?.price_per_kg);
  fill('ovr_sg_bottom',         botCmpd?.sg);
  fill('ovr_cover_rate_bottom', botCmpd?.price_per_kg);
  fill('ovr_skim_rate',         skimCmpd?.price_per_kg);
}

function autoFillCopRate(container, overwrite = false) {
  const beltTypeId = container.querySelector('[name="belt_type_id"]')?.value;
  if (!beltTypeId) return;
  const bt = BELT_TYPE_MASTER.find(r => r.id === beltTypeId);
  const rate = bt?.cost_of_production_rate_per_kg;
  if (rate == null) return;
  const el = container.querySelector('[name="cop_rate_per_kg"]');
  if (el && (overwrite || !el.value)) el.value = rate;
}

// ─── Derived display helpers ───────────────────────────────────────────────────

function updateBeltRating(container) {
  const ft = container.querySelector('[name="fabric_type"]')?.value ?? '';
  const fs = container.querySelector('[name="fabric_strength"]')?.value ?? '';
  const pl = container.querySelector('[name="plies"]')?.value ?? '';
  const tc = container.querySelector('[name="top_cover_thickness_mm"]')?.value ?? '';
  const bc = container.querySelector('[name="bottom_cover_thickness_mm"]')?.value ?? '';
  const el = container.querySelector('#belt-rating-display');
  if (!el) return;
  if (ft && fs && pl) {
    el.textContent = tc && bc ? `${ft}-${fs}/${pl} ${tc}+${bc}` : `${ft}-${fs}/${pl}`;
  } else {
    el.textContent = '—';
  }
}

function updateDerivedDisplays(container, _line) {
  // Live masters
  const _PACKING = getLivePacking();
  const _FREIGHT = getLiveFreight();
  const _BREAKER = getLiveBreakers();

  // Packing cost from selected packing type
  const packingId  = container.querySelector('[name="packing_type_id"]')?.value;
  const packingRow = _PACKING.find(r => r.id === packingId);
  const pkEl = container.querySelector('#packing-cost-display');
  if (pkEl) pkEl.value = packingRow ? packingRow.packing_cost_per_meter.toFixed(2) : '—';

  // Reel cost from selected reel type
  const reelId  = container.querySelector('[name="reel_type_id"]')?.value;
  const reelRow = _PACKING.find(r => r.id === reelId);
  const rlEl = container.querySelector('#reel-cost-display');
  if (rlEl) rlEl.value = reelRow ? reelRow.packing_cost_per_meter.toFixed(2) : '—';

  // Freight cost auto-fill from destination
  const freightId  = container.querySelector('[name="freight_id"]')?.value;
  const freightRow = _FREIGHT.find(r => r.id === freightId);
  const frtInput   = container.querySelector('[name="freight_cost_override"]');
  if (frtInput && freightRow && !frtInput.value) {
    frtInput.value = freightRow.rate_per_kg.toFixed(2);
  }

  // Breaker ply defaults — read from the Breaker Fabric select
  const botEnabled   = container.querySelector('[name="breaker_top_enabled"]')?.value === 'yes';
  const bobEnabled   = container.querySelector('[name="breaker_bot_enabled"]')?.value === 'yes';
  const brkTopSelId  = container.querySelector('[name="breaker_top_id"]')?.value;
  const brkBotSelId  = container.querySelector('[name="breaker_bot_id"]')?.value;
  const brkTop = botEnabled ? _BREAKER.find(r => r.id === (brkTopSelId || 'BRK-TOP')) : null;
  const brkBot = bobEnabled ? _BREAKER.find(r => r.id === (brkBotSelId || 'BRK-BOB')) : null;
  const pTopEl = container.querySelector('#brk-top-ply-input');
  const pBotEl = container.querySelector('#brk-bot-ply-input');
  if (pTopEl && brkTop?.no_of_ply_default != null && !pTopEl.value) pTopEl.value = brkTop.no_of_ply_default;
  if (pBotEl && brkBot?.no_of_ply_default != null && !pBotEl.value) pBotEl.value = brkBot.no_of_ply_default;

  // Total quantity
  const lpRoll  = Number(container.querySelector('[name="length_per_roll_m"]')?.value);
  const rolls   = Number(container.querySelector('[name="no_of_rolls"]')?.value);
  const tqEl    = container.querySelector('#total-qty-display');
  if (tqEl) tqEl.value = lpRoll && rolls ? lpRoll * rolls : '—';

  // Width unit label
  const unit = container.querySelector('[name="unit_system"]')?.value ?? 'metric';
  const wuEl = container.querySelector('#width-unit-label');
  if (wuEl) wuEl.textContent = unit === 'imperial' ? 'in' : 'mm';

  // Fabric-derived: carcass thickness, GSM, price/kg
  const fabricType     = container.querySelector('[name="fabric_type"]')?.value;
  const fabricStrength = Number(container.querySelector('[name="fabric_strength"]')?.value) || null;
  const plies          = Number(container.querySelector('[name="plies"]')?.value) || null;
  const fabricRow = (fabricType && fabricStrength && plies)
    ? FABRIC_STRENGTH_MASTER.find(r => r.fabric_type === fabricType && r.total_strength === fabricStrength && r.no_of_ply === plies)
    : null;
  // Effective carcass thickness: customer-specified overrides master
  const customerCarcassRaw = Number(container.querySelector('[name="customer_carcass_thickness_mm"]')?.value) || null;
  const masterCarcassMm    = fabricRow?.nominal_carcass_thickness_mm ?? null;
  const eff_carcass_mm     = customerCarcassRaw ?? masterCarcassMm;

  // Populate the master carcass display input
  const carcassMasterInput = container.querySelector('#carcass-master-input');
  if (carcassMasterInput) carcassMasterInput.value = masterCarcassMm != null ? String(masterCarcassMm) : '';

  // Dim the master row when customer override is active
  const carcassMasterRow = container.querySelector('#carcass-master-row');
  if (carcassMasterRow) carcassMasterRow.classList.toggle('cf-row-overridden', !!customerCarcassRaw);

  // Carcass chip shows effective value (master or customer override)
  const cThkEl = container.querySelector('#carcass-thk-display');
  if (cThkEl) cThkEl.textContent = eff_carcass_mm != null ? String(eff_carcass_mm) : '—';

  // Base fabric code (e.g. NN-200)
  const baseFabricEl = container.querySelector('#base-fabric-display');
  if (baseFabricEl) {
    const ppr = (fabricStrength && plies) ? fabricStrength / plies : null;
    baseFabricEl.textContent = (fabricType && ppr) ? `${fabricType}-${ppr}` : '—';
  }

  // Total Belt Thickness
  const topThk = Number(container.querySelector('[name="top_cover_thickness_mm"]')?.value) || 0;
  const botThk = Number(container.querySelector('[name="bottom_cover_thickness_mm"]')?.value) || 0;
  const tbtVal = (eff_carcass_mm != null && (topThk || botThk)) ? (eff_carcass_mm + topThk + botThk).toFixed(2) + ' mm' : '—';

  const tbtEl = container.querySelector('#tbt-display');
  if (tbtEl) tbtEl.textContent = tbtVal;


  // Belt Description string + panel visibility
  const beltDescEl    = container.querySelector('#belt-desc-display');
  const beltDescPanel = container.querySelector('#belt-desc-panel');
  {
    const wMm     = container.querySelector('[name="width_mm"]')?.value;
    const fs      = container.querySelector('[name="fabric_strength"]')?.value;
    const pl      = container.querySelector('[name="plies"]')?.value;
    const topT    = container.querySelector('[name="top_cover_thickness_mm"]')?.value;
    const botT    = container.querySelector('[name="bottom_cover_thickness_mm"]')?.value;
    const topCmpd = getLiveCompounds().find(r => r.id === container.querySelector('[name="top_cover_compound_id"]')?.value);
    const edgeOpt = container.querySelector('[name="edge_id"] option:checked');
    const openEnd = container.querySelector('[name="open_end_type"]')?.value;
    const botOn   = container.querySelector('[name="breaker_top_enabled"]')?.value === 'yes';
    const bobOn   = container.querySelector('[name="breaker_bot_enabled"]')?.value === 'yes';
    const brkStr  = [botOn && 'BOT', bobOn && 'BOB'].filter(Boolean).join('/');

    const descComplete = !!(wMm && fabricType && fs && pl && topT && botT && topCmpd);
    if (beltDescPanel) beltDescPanel.style.display = descComplete ? 'block' : 'none';

    if (beltDescEl) {
      if (wMm && fabricType && fs && pl) {
        const parts = [
          `${wMm}`,
          fabricType,
          `${fs}/${pl}`,
          (topT && botT) ? `${topT}/${botT}` : null,
          topCmpd?.code ?? null,
          edgeOpt?.textContent?.trim() ?? null,
          brkStr || null,
          openEnd === 'ENDLESS' ? 'Endless' : 'Open',
        ].filter(Boolean);
        beltDescEl.textContent = parts.join(' × ');
      } else {
        beltDescEl.textContent = '—';
      }
    }
  }

  // Show/hide the spec chips panel once fabric + strength + plies are all set
  const specPanel = container.querySelector('#spec-chips-panel');
  if (specPanel) specPanel.style.display = (fabricType && fabricStrength && plies) ? 'block' : 'none';

  const fabricRateRow = fabricRow
    ? FABRIC_RATE_MASTER.grades.find(r => r.fabric_type === fabricType && r.per_ply_rating === fabricRow.per_ply_rating)
    : null;
  const fabricDefault = fabricType ? FABRIC_RATE_MASTER.type_defaults.find(r => r.fabric_type === fabricType) : null;

  const styleEl = container.querySelector('#fabric-style-type-display');
  if (styleEl) {
    const ftRow = FABRIC_TYPE_MASTER.find(r => r.code === fabricType);
    styleEl.textContent = ftRow?.name ?? '—';
  }
  const gsmEl      = container.querySelector('#fabric-gsm-display');
  const gsmOverride = parseFloat(container.querySelector('[name="ovr_fabric_gsm"]')?.value);
  const effGsm      = !isNaN(gsmOverride) ? gsmOverride : fabricRateRow?.gsm;
  if (gsmEl) {
    gsmEl.textContent = effGsm != null ? String(effGsm) : '—';
    gsmEl.style.color  = !isNaN(gsmOverride) ? 'var(--color-accent-dk)' : '';
    gsmEl.title        = !isNaN(gsmOverride) ? 'Manual override active' : '';
  }
  const fThkEl  = container.querySelector('#fabric-thickness-display');
  if (fThkEl) fThkEl.textContent = fabricRateRow?.thickness_mm != null ? `${fabricRateRow.thickness_mm} mm` : '—';
  const priceEl = container.querySelector('#fabric-price-display');
  const fPrice  = fabricRateRow?.price_per_kg ?? fabricDefault?.default_rate_per_kg;
  if (priceEl) priceEl.textContent = fPrice != null ? `₹${fPrice.toFixed(2)}` : '—';

  // Skim ↔ Cover match
  updateSkimMatchDisplay(container);
}

// ─── Skim ↔ Cover match check display ─────────────────────────────────────────

function updateSkimMatchDisplay(container) {
  const _COMPOUND = getLiveCompounds();
  const topId  = container.querySelector('[name="top_cover_compound_id"]')?.value;
  const skimId = container.querySelector('[name="skim_compound_id"]')?.value;
  const topCmpd  = topId  ? _COMPOUND.find(r => r.id === topId)  : null;
  const skimCmpd = skimId ? _COMPOUND.find(r => r.id === skimId) : null;

  const gfEl   = container.querySelector('#skim-match-grade-family');
  const sfEl   = container.querySelector('#skim-match-skim-family');
  const recEl  = container.querySelector('#skim-match-recommended');
  const statEl = container.querySelector('#skim-match-status');
  const hintEl = container.querySelector('#skim-auto-hint');

  if (gfEl)  gfEl.textContent  = topCmpd?.grade_family  ?? '—';
  if (sfEl)  sfEl.textContent  = skimCmpd?.grade_family ?? '—';

  const compatEntry = topCmpd ? COVER_SKIM_COMPATIBILITY?.find(c => c.cover_grade_family === topCmpd.grade_family) : null;
  const recSkim     = compatEntry ? _COMPOUND.find(r => r.id === compatEntry.skim_compound_id) : null;

  if (recEl) recEl.textContent = recSkim ? `${recSkim.code} — ${recSkim.name}` : '—';

  if (hintEl) {
    if (recSkim && !skimId) {
      hintEl.textContent   = `Recommended: ${recSkim.code}`;
      hintEl.style.display = 'inline';
    } else {
      hintEl.style.display = 'none';
    }
  }

  if (statEl) {
    if (!skimCmpd) {
      statEl.innerHTML = '<span style="color:var(--color-text-muted)">— not selected —</span>';
    } else if (!recSkim) {
      statEl.innerHTML = '<span style="color:var(--color-text-muted)">No rule defined</span>';
    } else if (skimCmpd.id === recSkim.id) {
      statEl.innerHTML = '<span style="color:var(--color-success)">✓ Match</span>';
    } else {
      statEl.innerHTML = '<span style="color:var(--color-danger)">✗ Mismatch — recommended: ' + escHtml(recSkim.code) + '</span>';
    }
  }
}

// ─── Width combobox ────────────────────────────────────────────────────────────

function setupWidthCombobox(container) {
  if (_isReadOnly) return;
  const input    = container.querySelector('#width-input');
  const dropdown = container.querySelector('#width-dropdown');
  const hiddenId = container.querySelector('#width-id-hidden');
  const hint     = container.querySelector('#width-custom-hint');
  if (!input) return;

  const allWidths = getWidthOptions();
  let activeIdx   = -1;

  function renderDropdown(filtered) {
    if (!filtered.length) { dropdown.style.display = 'none'; return; }
    activeIdx = -1;
    dropdown.innerHTML = filtered.slice(0, 15).map(w =>
      `<div class="combobox-option" data-value="${w.value}" data-id="${w.id}">${w.display}</div>`
    ).join('');
    dropdown.style.display = 'block';
  }

  function highlightOption() {
    dropdown.querySelectorAll('.combobox-option').forEach((el, i) => {
      el.style.background = i === activeIdx ? 'var(--color-primary,#0F2A44)' : '';
      el.style.color      = i === activeIdx ? '#fff' : '';
    });
  }

  function confirmWidth(value, id) {
    input.value            = value;
    hiddenId.value         = id;
    hint.style.display     = 'none';
    dropdown.style.display = 'none';
    activeIdx              = -1;
    recalc(container);
  }

  function updateHidden(raw) {
    const num   = parseInt(raw, 10);
    const match = !isNaN(num) ? findWidth(num) : null;
    if (match) { hiddenId.value = match.id;       hint.style.display = 'none'; }
    else if (!isNaN(num) && num >= 50 && num <= 4000) { hiddenId.value = `CUSTOM-${num}`; hint.style.display = 'inline'; }
    else        { hiddenId.value = '';             hint.style.display = 'none'; }
  }

  function openDropdown() {
    const raw = input.value.trim();
    const filtered = raw ? allWidths.filter(w => String(w.value).startsWith(raw)) : allWidths;
    renderDropdown(filtered);
  }

  input.addEventListener('input', () => {
    const raw = input.value.trim();
    if (!raw) { dropdown.style.display = 'none'; hiddenId.value = ''; hint.style.display = 'none'; return; }
    updateHidden(raw);
    openDropdown();
  });

  // Open full list on focus or click (even if already focused with a value)
  input.addEventListener('focus', () => { input.select(); openDropdown(); });
  input.addEventListener('click', () => { input.select(); openDropdown(); });

  // Keyboard: arrows to navigate, Enter to confirm
  input.addEventListener('keydown', e => {
    const opts = [...dropdown.querySelectorAll('.combobox-option')];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, opts.length - 1);
      highlightOption();
      opts[activeIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      highlightOption();
      opts[activeIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && opts[activeIdx]) {
        confirmWidth(opts[activeIdx].dataset.value, opts[activeIdx].dataset.id);
      } else if (hiddenId.value) {
        dropdown.style.display = 'none';
        activeIdx = -1;
        recalc(container);
      }
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
      activeIdx = -1;
    }
  });

  // Click on a dropdown option
  dropdown.addEventListener('mousedown', e => {
    const opt = e.target.closest('.combobox-option');
    if (!opt) return;
    e.preventDefault();
    confirmWidth(opt.dataset.value, opt.dataset.id);
  });

  input.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; activeIdx = -1; }, 150));
}

// ─── Data collection ───────────────────────────────────────────────────────────

function collectLine(container) {
  const f    = sel => container.querySelector(`[name="${sel}"]`)?.value;
  const fNum = sel => { const v = f(sel); return v !== '' && v != null ? Number(v) : null; };

  const freightEnabled = container.querySelector('[name="freight_included"]')?.value !== 'no';
  const discEnabled    = container.querySelector('[name="discount_enabled"]')?.value === 'yes';
  const discount_pct   = discEnabled ? (fNum('discount_pct_input') ?? 0) / 100 : 0;

  const _BREAKER  = getLiveBreakers();
  const _PACKING  = getLivePacking();
  const brkTopId  = container.querySelector('[name="breaker_top_enabled"]')?.value === 'yes' ? (f('breaker_top_id') || null) : null;
  const brkBotId  = container.querySelector('[name="breaker_bot_enabled"]')?.value === 'yes' ? (f('breaker_bot_id') || null) : null;
  const brkTopRow = brkTopId ? _BREAKER.find(r => r.id === brkTopId) : null;
  const brkBotRow = brkBotId ? _BREAKER.find(r => r.id === brkBotId) : null;

  const packingTypeId = f('packing_type_id');
  const packingRow    = _PACKING.find(r => r.id === packingTypeId);

  return {
    product_type_id:              f('product_type_id'),
    belt_type_id:                 f('belt_type_id'),
    belt_type_code:               BELT_TYPE_MASTER.find(r => r.id === f('belt_type_id'))?.code,
    unit_system:                  f('unit_system') ?? 'metric',
    open_end_type:                container.querySelector('[name="open_end_type"]')?.value ?? 'OPEN_END',
    endless_length_m:             Math.min(fNum('endless_length_m') ?? 0, 100) || null,
    width_mm:                     fNum('width_mm'),
    width_id:                     f('width_id'),
    fabric_make:                  f('fabric_make'),
    fabric_type:                  f('fabric_type'),
    fabric_strength:              fNum('fabric_strength'),
    plies:                        fNum('plies'),
    top_cover_thickness_mm:       fNum('top_cover_thickness_mm'),
    bottom_cover_thickness_mm:    fNum('bottom_cover_thickness_mm'),
    top_cover_compound_id:        f('top_cover_compound_id'),
    bottom_cover_compound_id:     f('bottom_cover_compound_id'),
    skim_compound_id:             f('skim_compound_id'),
    breaker_top_id:               brkTopId,
    breaker_top_ply:              brkTopId ? (fNum('breaker_top_ply') ?? brkTopRow?.no_of_ply_default ?? null) : null,
    ovr_breaker_top_gsm:          brkTopId ? fNum('ovr_breaker_top_gsm') : null,
    breaker_top_skim_compound_id: brkTopId ? f('breaker_top_skim_compound_id') : null,
    breaker_bot_id:               brkBotId,
    breaker_bot_ply:              brkBotId ? (fNum('breaker_bot_ply') ?? brkBotRow?.no_of_ply_default ?? null) : null,
    ovr_breaker_bot_gsm:          brkBotId ? fNum('ovr_breaker_bot_gsm') : null,
    breaker_bot_skim_compound_id: brkBotId ? f('breaker_bot_skim_compound_id') : null,
    edge_id:                      f('edge_id'),
    length_per_roll_m:            fNum('length_per_roll_m'),
    no_of_rolls:                  fNum('no_of_rolls'),
    cop_rate_per_kg:              fNum('cop_rate_per_kg'),
    reel_type_id:                 f('reel_type_id'),
    packing_type_id:              packingTypeId,
    reel_packing_id:              packingTypeId,   // engine uses reel_packing_id
    freight_included:             freightEnabled,
    freight_id:                   freightEnabled ? f('freight_id') : null,
    freight_cost_type:            f('freight_cost_type') ?? 'KG',
    freight_cost_override:        fNum('freight_cost_override'),
    currency_id:                  f('currency_id') || null,
    exchange_rate:                fNum('exchange_rate'),
    gp_pct_direct:                fNum('gp_pct_direct'),
    discount_pct,
    discount_price_type:          f('discount_price_type') ?? 'CD',
    custom_final_price_per_m:     fNum('custom_final_price_per_m'),
    // Overrides §8.7
    ovr_cover_rate_top:           fNum('ovr_cover_rate_top'),
    ovr_cover_rate_bottom:        fNum('ovr_cover_rate_bottom'),
    ovr_sg_top:                   fNum('ovr_sg_top'),
    ovr_sg_bottom:                fNum('ovr_sg_bottom'),
    ovr_skim_rate:                fNum('ovr_skim_rate'),
    ovr_fabric_price:             fNum('ovr_fabric_price'),
    ovr_fabric_gsm:               fNum('ovr_fabric_gsm'),
    ovr_expenses_per_kg:          fNum('ovr_expenses_per_kg'),
    customer_carcass_thickness_mm: fNum('customer_carcass_thickness_mm'),
    customer_tbt_mm:               fNum('customer_tbt_mm'),
    customer_fabric_type:          f('customer_fabric_type') || null,
    customer_fabric_strength:      fNum('customer_fabric_strength'),
    customer_grade:                f('customer_grade') || null,
    // Post-order tracking §8.12
  };
}

// ─── Calculate / recalc ───────────────────────────────────────────────────────

function recalc(container) {
  try {
    updateDerivedDisplays(container, null);
    updateBeltRating(container);
  } catch (e) {
    console.error('recalc derived error:', e);
  }

  const line = collectLine(container);

  // Core belt geometry required before engine runs.
  // length_per_roll_m / no_of_rolls get defaults below so live preview works
  // as soon as Phase 2+3 are complete (Phase 4 not yet needed).
  const coreRequired = [
    'belt_type_id', 'width_mm', 'fabric_type', 'fabric_strength', 'plies',
    'top_cover_compound_id', 'top_cover_thickness_mm',
    'bottom_cover_compound_id', 'bottom_cover_thickness_mm',
  ];
  if (coreRequired.some(k => !line[k] && line[k] !== 0)) return;

  // Build engine-ready copy — substitute defaults for any unfilled optional field
  const el = { ...line };

  // Live masters for default fallbacks
  const _EDGE    = getLiveEdges();
  const _CMPD    = getLiveCompounds();
  const _PACK    = getLivePacking();

  // Edge: default to first active edge if not yet selected
  if (!el.edge_id) el.edge_id = _EDGE.find(r => r.active !== false)?.id;
  if (!el.edge_id) return;

  // Skim compound: resolve from cover-skim compatibility table, or fall back to first active skim
  if (!el.skim_compound_id) {
    const topCmpd  = _CMPD.find(r => r.id === el.top_cover_compound_id);
    const compat   = topCmpd ? COVER_SKIM_COMPATIBILITY?.find(c => c.cover_grade_family === topCmpd.grade_family) : null;
    const skimList = _CMPD.filter(r => r.roles?.split('|').includes('SKIM') && r.active !== false);
    el.skim_compound_id = compat?.skim_compound_id ?? skimList[0]?.id;
  }
  if (!el.skim_compound_id) return;

  // Packing: default to first active packing entry
  if (!el.reel_packing_id) {
    const defPack = _PACK.find(r => (r.applies_to === 'packing' || r.applies_to === 'both') && r.active !== false);
    el.reel_packing_id = defPack?.id;
  }
  if (!el.reel_packing_id) return;

  // Freight: destination is optional — if a manual rate is entered, use it.
  // Only force freight off when both destination AND manual rate are absent.
  if (el.freight_included && !el.freight_id && !el.freight_cost_override) el.freight_included = false;

  // GP%: default to 20 if the field hasn't been touched
  if (el.gp_pct_direct == null || el.gp_pct_direct === '') el.gp_pct_direct = 20;

  // Quantity defaults — live preview at 100m × 1 roll until Phase 4 is filled
  if (!el.length_per_roll_m) el.length_per_roll_m = 100;
  if (!el.no_of_rolls)       el.no_of_rolls = 1;

  // Build overrides object from §8.7 override fields
  const overrides = {};
  if (el.ovr_cover_rate_top    != null) overrides.cover_rate_top    = el.ovr_cover_rate_top;
  if (el.ovr_cover_rate_bottom != null) overrides.cover_rate_bottom = el.ovr_cover_rate_bottom;
  if (el.ovr_sg_top            != null) overrides.sg_top            = el.ovr_sg_top;
  if (el.ovr_sg_bottom         != null) overrides.sg_bottom         = el.ovr_sg_bottom;
  if (el.ovr_skim_rate         != null) overrides.skim_rate         = el.ovr_skim_rate;
  if (el.ovr_fabric_price      != null) overrides.fabric_price      = el.ovr_fabric_price;
  if (el.ovr_fabric_gsm        != null) overrides.fabric_gsm        = el.ovr_fabric_gsm;
  if (el.ovr_breaker_top_gsm   != null) overrides.breaker_top_gsm   = el.ovr_breaker_top_gsm;
  if (el.ovr_breaker_bot_gsm   != null) overrides.breaker_bot_gsm   = el.ovr_breaker_bot_gsm;
  if (el.ovr_expenses_per_kg         != null) overrides.expenses_per_kg    = el.ovr_expenses_per_kg;
  if (el.customer_carcass_thickness_mm != null) overrides.carcass_thickness_mm = el.customer_carcass_thickness_mm;

  try {
    const result = runEngine(el, overrides);
    _currentResult = result;
    renderResults(container, result);
  } catch (err) {
    const es = container.querySelector('#results-empty-state');
    if (es) es.style.display = 'none';
    container.querySelector('#results-warnings').innerHTML =
      `<div class="alert-banner"><p>⚠ Engine error: ${escHtml(err.message)}</p></div>`;
  }
}

// ─── Render results ────────────────────────────────────────────────────────────

function renderResults(container, result) {
  if (!result) return;
  const es = container.querySelector('#results-empty-state');
  if (es) es.style.display = 'none';
  const { derived: d, costs: c, pricing: p, inputs: inp, warnings } = result;

  // Warnings
  const gpApplied = p.gp_pct_applied != null ? p.gp_pct_applied * 100 : null;
  const allWarnings = [...warnings];
  if (gpApplied != null && gpApplied < 20) {
    allWarnings.unshift(`GP% is ${gpApplied.toFixed(1)}% — below the 20% minimum. Approved override in effect.`);
  }
  container.querySelector('#results-warnings').innerHTML = allWarnings.length
    ? `<div class="alert-banner">${allWarnings.map(w => `<p>⚠ ${escHtml(w)}</p>`).join('')}</div>`
    : '';

  // ── KPI strip ────────────────────────────────────────────────────────────────
  setText(container, '#rs-price',    p.cd_price_per_meter != null ? formatRupees(p.cd_price_per_meter) + ' / m' : '—');
  setText(container, '#rs-vd-price', p.vd_price_per_meter != null ? formatRupees(p.vd_price_per_meter) + ' / m' : '—');
  setText(container, '#rs-rmc',      p.rmc_per_meter      != null ? formatRupees(p.rmc_per_meter)      + ' / m' : '—');
  setText(container, '#rs-total-wt', d.calc_weight_per_meter_kg > 0 ? formatKg(d.calc_weight_per_meter_kg) + ' / m' : '—');
  setText(container, '#r-total-length', d.total_length_m  != null ? d.total_length_m.toFixed(2) + ' m'          : '—');

  // ── Block 1 — Belt Specification chips ───────────────────────────────────────
  const s = result.snapshot ?? {};
  const fabricRow = (() => {
    try { return (typeof FABRIC_STRENGTH_MASTER !== 'undefined')
      ? FABRIC_STRENGTH_MASTER.find(r => r.fabric_type === inp.fabric_type && r.total_strength === inp.fabric_strength && r.no_of_ply === inp.plies)
      : null; } catch(_) { return null; }
  })();
  setText(container, '#ri-width',       inp.width_mm       ? `${inp.width_mm} mm`                              : '—');
  setText(container, '#ri-fabric-type', inp.fabric_type    ?? '—');
  setText(container, '#ri-rating',      inp.fabric_strength ? `${inp.fabric_strength} kN/m`                    : '—');
  setText(container, '#ri-plies',       inp.plies          ? `${inp.plies} ply`                                : '—');
  setText(container, '#ri-top',         inp.top_cover_thickness_mm    ? `${inp.top_cover_thickness_mm} mm`     : '—');
  setText(container, '#ri-bot',         inp.bottom_cover_thickness_mm ? `${inp.bottom_cover_thickness_mm} mm`  : '—');
  setText(container, '#ri-grade',       s.top_cover?.code  ?? '—');

  // ── Block 2 — Weight Calculations ────────────────────────────────────────────
  const fKg  = v => v != null && v >= 0 ? formatKg(v)    : '—';
  const fPm  = v => v != null && v >  0 ? formatKg(v) + ' / m' : '—';

  setText(container, '#rw-fabric-pm',  fPm(d.fabric_weight_per_m));
  setText(container, '#rw-fabric-kg',  fKg(d.fabric_weight_kg));
  setText(container, '#rw-top-pm',     fPm(d.top_cover_weight_per_m));
  setText(container, '#rw-top-kg',     fKg(d.top_cover_weight_kg));
  setText(container, '#rw-bot-pm',     fPm(d.bottom_cover_weight_per_m));
  setText(container, '#rw-bot-kg',     fKg(d.bottom_cover_weight_kg));
  setText(container, '#rw-skim-pm',    fPm(d.skim_weight_per_m));
  setText(container, '#rw-skim-kg',    fKg(d.skim_weight_kg));
  setText(container, '#rw-compound-pm', fPm(d.fabric_compound_weight_per_m));
  setText(container, '#rw-compound-kg', fKg(d.fabric_compound_weight_kg));

  const hasBOT = d.bot_weight_kg > 0;
  const hasBOB = d.bob_weight_kg > 0;
  const botRow = container.querySelector('#rw-bot-row');
  const bobRow = container.querySelector('#rw-bob-row');
  if (botRow) botRow.style.display = hasBOT ? '' : 'none';
  if (bobRow) bobRow.style.display = hasBOB ? '' : 'none';
  if (hasBOT) { setText(container, '#rw-bot-brk-pm', fPm(d.bot_weight_per_m)); setText(container, '#rw-bot-brk-kg', fKg(d.bot_weight_kg)); }
  if (hasBOB) { setText(container, '#rw-bob-brk-pm', fPm(d.bob_weight_per_m)); setText(container, '#rw-bob-brk-kg', fKg(d.bob_weight_kg)); }

  setText(container, '#rw-calc-pm',   fPm(d.calc_weight_per_meter_kg));
  setText(container, '#rw-calc-kg',   fKg(d.total_calc_weight_kg));
  setText(container, '#rw-actual-pm', fPm(d.actual_weight_per_m_blended));
  setText(container, '#rw-actual-kg', fKg(d.total_actual_belt_weight_kg));

  // ── Block 3 — Costing ────────────────────────────────────────────────────────
  const fRs  = v => v != null && v >= 0 ? formatRupees(v)            : '—';
  const fRpm = v => v != null && v >  0 ? formatRupees(v) + ' / m'   : '—';

  setText(container, '#rc-fabric-pm',   fRpm(c.fabric_cost_per_m));
  setText(container, '#rc-fabric-tot',  fRs(c.fabric_cost));
  setText(container, '#rc-top-pm',      fRpm(c.top_cover_cost_per_m));
  setText(container, '#rc-top-tot',     fRs(c.top_cover_cost));
  setText(container, '#rc-bot-pm',      fRpm(c.bottom_cover_cost_per_m));
  setText(container, '#rc-bot-tot',     fRs(c.bottom_cover_cost));
  setText(container, '#rc-skim-pm',     fRpm(c.skim_cost_per_m));
  setText(container, '#rc-skim-tot',    fRs(c.skim_cost));
  setText(container, '#rc-compound-pm',  fRpm(c.fabric_compound_cost_per_m));
  setText(container, '#rc-compound-tot', fRs(c.fabric_compound_cost));

  const cBotRow = container.querySelector('#rc-bot-row');
  const cBobRow = container.querySelector('#rc-bob-row');
  if (cBotRow) cBotRow.style.display = (c.breaker_top_total_cost > 0) ? '' : 'none';
  if (cBobRow) cBobRow.style.display = (c.breaker_bot_total_cost > 0) ? '' : 'none';
  if (c.breaker_top_total_cost > 0) { setText(container, '#rc-bot-brk-pm', fRpm(c.breaker_top_cost_per_m)); setText(container, '#rc-bot-brk-tot', fRs(c.breaker_top_total_cost)); }
  if (c.breaker_bot_total_cost > 0) { setText(container, '#rc-bob-brk-pm', fRpm(c.breaker_bot_cost_per_m)); setText(container, '#rc-bob-brk-tot', fRs(c.breaker_bot_total_cost)); }

  setText(container, '#rc-calc-pm',    fRpm(c.material_cost_per_m));
  setText(container, '#rc-calc-tot',   fRs(c.material_cost));
  setText(container, '#rc-actual-pm',  fRpm(c.actual_material_cost_per_m));
  setText(container, '#rc-actual-tot', fRs(c.actual_material_cost));

  // ── Block 4 — Pricing ────────────────────────────────────────────────────────
  const fRkg = v => v != null && v > 0 ? formatRupees(v) + ' / kg' : '—';

  setText(container, '#rp-rmc-pm',      fRpm(p.rmc_per_meter));
  setText(container, '#rp-rmc-kg',      fRkg(p.rmc_per_kg));
  setText(container, '#rp-rmc-tot',     fRs(p.total_rmc_cost));

  setText(container, '#rp-rmcvd-pm',    fRpm(p.material_cost_per_m));
  setText(container, '#rp-rmcvd-kg',    fRkg(p.material_cost_per_kg));
  setText(container, '#rp-rmcvd-tot',   fRs(c.material_cost));

  setText(container, '#rp-rmcgp-pm',    fRpm(p.cd_price_per_meter));
  setText(container, '#rp-rmcgp-kg',    fRkg(p.cd_price_per_kg));
  setText(container, '#rp-rmcgp-tot',   fRs(p.cd_total));

  setText(container, '#rp-rmcvdgp-pm',  fRpm(p.vd_price_per_meter));
  setText(container, '#rp-rmcvdgp-kg',  fRkg(p.vd_price_per_kg));
  setText(container, '#rp-rmcvdgp-tot', fRs(p.vd_total));

  setText(container, '#rp-crate-pm',    fRpm(p.crate_cost_per_m));
  setText(container, '#rp-crate-kg',    fRkg(p.crate_cost_per_kg));
  setText(container, '#rp-crate-tot',   fRs(p.crate_cost_total));

  const reelRow = container.querySelector('#rp-reel-row');
  if (reelRow) reelRow.style.display = (p.reel_cost_total > 0) ? '' : 'none';
  setText(container, '#rp-reel-pm',    fRpm(p.reel_cost_per_m));
  setText(container, '#rp-reel-kg',    fRkg(p.reel_cost_per_kg));
  setText(container, '#rp-reel-tot',   fRs(p.reel_cost_total));

  const freightRow = container.querySelector('#rp-freight-row');
  if (freightRow) freightRow.style.display = (p.freight_cost_total > 0) ? '' : 'none';
  setText(container, '#rp-freight-pm',   fRpm(c.freight_cost_per_m));
  setText(container, '#rp-freight-kg',   fRkg(p.freight_cost_per_kg));
  setText(container, '#rp-freight-tot',  fRs(p.freight_cost_total));

  setText(container, '#rp-total-rmcvd-pm', fRpm(p.material_cost_per_m));
  setText(container, '#rp-total-rmcvd',    fRs(c.material_cost));

  setText(container, '#rp-total-quot-pm',  fRpm(p.vd_price_per_meter));
  setText(container, '#rp-total-quot-vd',  fRs(p.vd_total));

  // ── Skim compatibility card ───────────────────────────────────────────────────
  const skimCard = container.querySelector('#skim-match-card');
  const skimWarn = allWarnings.some(w => w.toLowerCase().includes('skim'));
  if (skimCard) skimCard.style.display = skimWarn ? '' : 'none';
  if (skimWarn) {
    const topCmpd = result.snapshot?.top_cover;
    const skimCmpd = result.snapshot?.skim;
    setText(container, '#skim-match-grade-family', topCmpd?.code ?? '—');
    setText(container, '#skim-match-skim-family',  skimCmpd?.code ?? '—');
    setText(container, '#skim-match-recommended',  '—');
    setText(container, '#skim-match-status',       'Check compatibility');
  }

  // ── Legacy hidden IDs (used by renderDetailedFields) ─────────────────────────
  const _lenM = d.total_length_m || 0;
  const _pm   = v => _lenM > 0 ? formatKg(v / _lenM) + '/m' : '—';
  setText(container, '#r-w-eff',           d.effective_width_m  != null ? d.effective_width_m.toFixed(4)  + ' m' : '—');
  setText(container, '#r-l-eff',           d.effective_length_m != null ? d.effective_length_m.toFixed(3) + ' m' : '—');
  setText(container, '#r-width-factor',    d.width_factor  != null ? d.width_factor.toFixed(4)  : '—');
  setText(container, '#r-length-factor',   d.length_factor != null ? d.length_factor.toFixed(4) : '—');
  setText(container, '#r-tbt',             d.tbt_mm != null ? d.tbt_mm.toFixed(2) + ' mm' : '—');
  setText(container, '#r-actual-wt-per-m', d.actual_weight_per_m_blended > 0 ? formatKg(d.actual_weight_per_m_blended) + '/m' : '—');
  setText(container, '#r-wt-per-m',        d.weight_per_meter_kg != null ? formatKg(d.weight_per_meter_kg) + '/m' : '—');
  setText(container, '#r-compound-gsm',    d.compound_gsm != null ? d.compound_gsm.toFixed(1) + ' g/m²' : '—');
  setText(container, '#r-actual-wt-m',     d.actual_weight_per_m_blended > 0 ? formatKg(d.actual_weight_per_m_blended) + ' / m' : '—');
  setText(container, '#r-calc-wt-per-m',   d.calc_weight_per_meter_kg > 0 ? formatKg(d.calc_weight_per_meter_kg) + ' / m' : '—');
  setText(container, '#r-total-actual-wt', d.total_actual_belt_weight_kg > 0 ? formatKg(d.total_actual_belt_weight_kg) : '—');
  setText(container, '#r-total-calc-wt',   d.total_calc_weight_kg > 0 ? formatKg(d.total_calc_weight_kg) : '—');
  setText(container, '#r-cover-top-val',   formatKg(d.top_cover_weight_kg));
  setText(container, '#r-cover-top-per-m', fPm(d.top_cover_weight_per_m));
  setText(container, '#r-cover-bot-val',   formatKg(d.bottom_cover_weight_kg));
  setText(container, '#r-cover-bot-per-m', fPm(d.bottom_cover_weight_per_m));
  setText(container, '#r-cover-val',       formatKg(d.top_cover_weight_kg + d.bottom_cover_weight_kg));
  setText(container, '#r-cover-per-m',     _lenM > 0 ? _pm(d.top_cover_weight_kg + d.bottom_cover_weight_kg) : '—');
  setText(container, '#r-compound-val',    formatKg(d.compound_weight_kg));
  setText(container, '#r-compound-per-m',  d.compound_weight_kg > 0 ? _pm(d.compound_weight_kg) : '—');
  setText(container, '#r-fabric-val',      formatKg(d.fabric_weight_kg));
  setText(container, '#r-fabric-per-m',    fPm(d.fabric_weight_per_m));
  setText(container, '#r-skim-val',        formatKg(d.skim_weight_kg));
  setText(container, '#r-skim-per-m',      fPm(d.skim_weight_per_m));
  setText(container, '#r-no-brk-val',      formatKg(d.belt_wt_without_breaker_kg));
  setText(container, '#r-no-brk-per-m',    d.belt_wt_without_breaker_kg > 0 ? _pm(d.belt_wt_without_breaker_kg) : '—');
  setText(container, '#r-total-wt',        formatKg(d.total_belt_weight_kg));
  setText(container, '#r-cover-cost',      formatRupees(c.top_cover_cost + c.bottom_cover_cost));
  setText(container, '#r-cover-cost-per-m', c.cover_cost_per_m > 0 ? formatRupees(c.cover_cost_per_m) + '/m' : '—');
  setText(container, '#r-fabric-cost',     formatRupees(c.fabric_cost));
  setText(container, '#r-fabric-cost-per-m', c.fabric_cost_per_m > 0 ? formatRupees(c.fabric_cost_per_m) + '/m' : '—');
  setText(container, '#r-skim-cost',       formatRupees(c.skim_cost));
  setText(container, '#r-skim-cost-per-m', c.skim_cost_per_m > 0 ? formatRupees(c.skim_cost_per_m) + '/m' : '—');
  setText(container, '#r-compound-cost-val',   formatRupees(c.total_compound_cost));
  setText(container, '#r-compound-cost-per-m', c.compound_cost_per_m > 0 ? formatRupees(c.compound_cost_per_m) + '/m' : '—');
  setText(container, '#r-cop-cost',        formatRupees(c.cost_of_production));
  setText(container, '#r-packing-cost',    formatRupees(c.packing_cost));
  setText(container, '#r-freight-cost',    formatRupees(c.freight_cost));
  setText(container, '#r-freight-cost-per-m', c.freight_cost_per_m > 0 ? formatRupees(c.freight_cost_per_m) + '/m' : '—');
  setText(container, '#r-total-cost',      formatRupees(c.total_belt_cost));
  const pricePerKg = d.total_belt_weight_kg > 0 ? c.total_belt_cost / d.total_belt_weight_kg : null;
  setText(container, '#r-price-per-kg', pricePerKg != null ? formatRupees(pricePerKg) + ' / kg' : '—');
  setText(container, '#r-brk1-cost',    formatRupees(c.breaker_top_cost));
  setText(container, '#r-brk1-skim-cost', formatRupees(c.breaker_top_skim_cost));
  setText(container, '#r-brk2-cost',    formatRupees(c.breaker_bot_cost));
  setText(container, '#r-brk2-skim-cost', formatRupees(c.breaker_bot_skim_cost));
  setText(container, '#r-rmc',          formatRupees(p.rmc_per_meter) + ' / m');
  setText(container, '#r-gp',           formatRupees(p.gp_value_cd));
  setText(container, '#r-gp-vd',        formatRupees(p.gp_value_vd));
  setText(container, '#r-cd-total',     formatRupees(p.cd_total));
  setText(container, '#r-cd-per-m',     formatRupees(p.cd_price_per_meter) + ' / m');
  setText(container, '#r-vd-total',     formatRupees(p.vd_total));
  setText(container, '#r-vd-per-m',     formatRupees(p.vd_price_per_meter) + ' / m');
  const widthMm = Number(inp?.width_mm ?? 0);
  if (widthMm > 0) {
    setText(container, '#r-cd-per-mm', formatRupees(p.cd_price_per_meter / widthMm) + ' / m / mm');
    setText(container, '#r-vd-per-mm', p.per_mm_vd_price != null ? formatRupees(p.per_mm_vd_price) + ' / m / mm' : '—');
  }
  setText(container, '#r-rmc-with-gp',   p.rmc_with_gp_per_m != null ? formatRupees(p.rmc_with_gp_per_m) + ' / m' : '—');
  setText(container, '#r-min-quot-rmc',  p.min_quotation_rmc_per_m != null ? formatRupees(p.min_quotation_rmc_per_m) + ' / m' : '—');
  setText(container, '#r-per-mm-running', p.per_mm_running_price_pre_quote != null ? formatRupees(p.per_mm_running_price_pre_quote) + ' / mm' : '—');
  setText(container, '#r-total-rmc-amount', formatRupees(c.total_belt_cost));
  setText(container, '#r-total-rmc-vd',  formatRupees(c.material_cost));
  setText(container, '#r-rmc-usd',       p.rmc_usd != null ? `$${p.rmc_usd.toFixed(2)} / m` : 'N/A — set exchange rate');
  setText(container, '#r-cd-usd',        p.quotation_usd != null ? `$${p.quotation_usd.toFixed(2)} / m` : 'N/A — set exchange rate');
  setText(container, '#cc-width',        d.effective_width_m != null ? `${(d.effective_width_m * 1000).toFixed(1)} mm` : '—');
  setText(container, '#cc-length',       d.effective_length_m != null ? d.effective_length_m.toFixed(3) + ' m' : '—');
  setText(container, '#cc-belt-wt',      d.weight_per_meter_kg != null ? formatKg(d.weight_per_meter_kg) + ' / m' : '—');
  setText(container, '#cc-len-per-ply',  d.effective_length_m != null ? d.effective_length_m.toFixed(3) + ' m' : '—');
  setText(container, '#cc-fab-gsm',      s.fabric?.gsm != null ? s.fabric.gsm.toFixed(1) + ' g/m²' : '—');
  setText(container, '#cc-fab-price',    s.fabric?.price_per_kg != null ? formatRupees(s.fabric.price_per_kg) + ' / kg' : '—');
  setText(container, '#cc-fab-weight',   d.fabric_weight_kg != null ? formatKg(d.fabric_weight_kg) : '—');
  setText(container, '#cc-fab-cost',     c.fabric_cost != null ? formatRupees(c.fabric_cost) : '—');
  setText(container, '#cc-brk-length',   d.effective_length_m != null ? d.effective_length_m.toFixed(3) + ' m' : '—');
  setText(container, '#cc-cmpd-wt',      d.compound_weight_kg != null ? formatKg(d.compound_weight_kg) : '—');
  setText(container, '#cc-total-cover-wt', ((d.top_cover_weight_kg ?? 0) + (d.bottom_cover_weight_kg ?? 0)) > 0 ? formatKg((d.top_cover_weight_kg ?? 0) + (d.bottom_cover_weight_kg ?? 0)) : '—');
  setText(container, '#cc-skim-wt',      d.skim_weight_kg != null ? formatKg(d.skim_weight_kg) : '—');
  setText(container, '#cc-cover-cost',   c.top_cover_cost != null && c.bottom_cover_cost != null ? formatRupees(c.top_cover_cost + c.bottom_cover_cost) : '—');
  setText(container, '#cc-skim-cost-chip', c.skim_cost != null ? formatRupees(c.skim_cost) : '—');
  setText(container, '#cc-total-cmpd-cost', c.total_compound_cost != null ? formatRupees(c.total_compound_cost) : '—');
  setText(container, '#cc-fab-brk-cost', c.fabric_plus_breaker_cost != null ? formatRupees(c.fabric_plus_breaker_cost) : '—');
  setText(container, '#cc-min-price',    p.rmc_per_meter != null ? formatRupees(p.rmc_per_meter) + ' / m' : '—');
  setText(container, '#cc-bot-gsm',      s.breaker_top?.gsm != null ? s.breaker_top.gsm.toFixed(1) + ' g/m²' : '—');
  setText(container, '#cc-bot-price',    s.breaker_top?.price_per_kg != null ? formatRupees(s.breaker_top.price_per_kg) + ' / kg' : '—');
  setText(container, '#cc-bot-fab-wt',   d.breaker_top_weight_kg > 0 ? formatKg(d.breaker_top_weight_kg) : '—');
  setText(container, '#cc-bob-gsm',      s.breaker_bot?.gsm != null ? s.breaker_bot.gsm.toFixed(1) + ' g/m²' : '—');
  setText(container, '#cc-bob-price',    s.breaker_bot?.price_per_kg != null ? formatRupees(s.breaker_bot.price_per_kg) + ' / kg' : '—');
  setText(container, '#cc-bob-fab-wt',   d.breaker_bot_weight_kg > 0 ? formatKg(d.breaker_bot_weight_kg) : '—');

  renderDetailedFields(container, result);
  updateDiscountResults(container, result);
}

function updateDiscountResults(container, result) {
  if (!result) return;
  const { pricing: p } = result;
  const priceType  = container.querySelector('[name="discount_price_type"]')?.value ?? 'CD';
  const finalTotal = priceType === 'VD' ? p.vd_final_total : p.cd_final_total;
  const finalPerM  = priceType === 'VD' ? p.vd_final_per_meter : p.cd_final_per_meter;
  setText(container, '#r-final-total', formatRupees(finalTotal));
  setText(container, '#r-final-per-m', formatRupees(finalPerM) + ' / m');
}

function renderDetailedFields(container, result) {
  const target = container.querySelector('#detailed-fields');
  if (!target) return;

  const i = result.inputs || {};
  const s = result.snapshot || {};
  const c = result.costs || {};
  const p = result.pricing || {};
  const d = result.derived || {};

  const customer    = getSelectLabel(container, 'customer_id');
  const enquiry     = getSelectLabel(container, 'enquiry_id');
  const productType = getSelectLabel(container, 'product_type_id');
  const beltType    = getSelectLabel(container, 'belt_type_id');
  const edge        = s.edge?.name ?? i.edge_id ?? '—';
  const freight     = s.freight?.state_name ?? (i.freight_included ? 'Selected' : 'No');
  const fabricRow   = FABRIC_STRENGTH_MASTER.find(r => r.fabric_type === i.fabric_type && r.total_strength === i.fabric_strength && r.no_of_ply === i.plies);
  const cct         = fabricRow?.nominal_carcass_thickness_mm;
  const tbt         = cct != null ? cct + (i.top_cover_thickness_mm || 0) + (i.bottom_cover_thickness_mm || 0) : null;
  const combinedRating = (i.fabric_type && i.fabric_strength && i.plies) ? `${i.fabric_type}-${i.fabric_strength}/${i.plies}` : '—';
  const widthMm = Number(i.width_mm ?? 0);
  const compoundFactor = (c.material_cost > 0 && c.total_compound_cost != null)
    ? `${((c.total_compound_cost / c.material_cost) * 100).toFixed(1)}%`
    : '—';

  const row = (label, value) => `
    <div class="cf-row">
      <div class="cf-label">${escHtml(label)}</div>
      <div class="cf-input">${escHtml(value ?? '—')}</div>
    </div>`;
  const hdr = (title) => `<div class="cf-section-title" style="margin-top:1rem">${escHtml(title)}</div>`;

  const sections = [
    hdr('Order Reference'),
    row('Quotation ID', _currentQuotation?.id ?? '—'),
    row('Customer', customer),
    row('Enquiry Ref', enquiry),
    row('Description', (() => { const enq = _currentQuotation?.enquiry_id ? storageGet(`enquiry.${_currentQuotation.enquiry_id}`) : null; return enq?.subject || '—'; })()),
    row('Special Note', container.querySelector('[name="special_note"]')?.value || '—'),

    hdr('Product Specification'),
    row('Product Type', productType),
    row('Belt Type', beltType),
    row('Open End / Endless', i.open_end_type || '—'),
    row('Endless Length', i.endless_length_m != null ? `${i.endless_length_m} m` : '—'),
    row('Width', i.width_mm != null ? `${i.width_mm} mm` : '—'),
    row('Fabric Make', i.fabric_make || '—'),
    row('Fabric Type', i.fabric_type || '—'),
    row('Fabric Style Type', FABRIC_TYPE_MASTER.find(r => r.code === i.fabric_type)?.name ?? '—'),
    row('Breaking Strength', i.fabric_strength != null ? `${i.fabric_strength} N/mm` : '—'),
    row('No. of Ply', i.plies != null ? i.plies : '—'),
    row('Short Form (Base Fabric)', d.base_fabric_code || '—'),
    row('Fabric Rating (per ply)', d.fabric_rating != null ? `${d.fabric_rating} N/mm/ply` : '—'),
    row('Combined Rating', combinedRating),
    row('Fabric GSM', d.fabric_gsm != null ? `${d.fabric_gsm} g/m²` : '—'),
    row('Fabric Thickness (per ply)', d.fabric_thickness_mm != null ? `${d.fabric_thickness_mm} mm` : '—'),

    hdr('Construction'),
    row('Carcass Thickness (CCT)', cct != null ? `${cct} mm` : '—'),
    row('Top Cover Thickness', i.top_cover_thickness_mm != null ? `${i.top_cover_thickness_mm} mm` : '—'),
    row('Bottom Cover Thickness', i.bottom_cover_thickness_mm != null ? `${i.bottom_cover_thickness_mm} mm` : '—'),
    row('Total Belt Thickness (TBT)', tbt != null ? `${tbt.toFixed(2)} mm` : '—'),
    row('Belt Construction Type', edge),
    row('BOT (Breaker On Top)', i.breaker_top_id ? `Yes (${i.breaker_top_ply ?? '—'} ply)` : 'No'),
    row('BOB (Breaker On Bottom)', i.breaker_bot_id ? `Yes (${i.breaker_bot_ply ?? '—'} ply)` : 'No'),

    hdr('Compounds & Rates'),
    row('Top Cover Compound', s.top_cover?.code ?? '—'),
    row('Top Cover SG', s.top_cover?.sg != null ? s.top_cover.sg : '—'),
    row('Top Cover Rate', s.top_cover?.price_per_kg != null ? formatRupees(s.top_cover.price_per_kg) + ' / kg' : '—'),
    row('Bottom Cover Compound', s.bottom_cover?.code ?? '—'),
    row('Bottom Cover SG', s.bottom_cover?.sg != null ? s.bottom_cover.sg : '—'),
    row('Bottom Cover Rate', s.bottom_cover?.price_per_kg != null ? formatRupees(s.bottom_cover.price_per_kg) + ' / kg' : '—'),
    row('Skim Compound', s.skim?.code ?? '—'),
    row('Skim Rate', s.skim?.price_per_kg != null ? formatRupees(s.skim.price_per_kg) + ' / kg' : '—'),
    row('Fabric Price', s.fabric?.price_per_kg != null ? formatRupees(s.fabric.price_per_kg) + ' / kg' : '—'),

    hdr('Quantity & Packing'),
    row('Length / Roll', i.length_per_roll_m != null ? `${i.length_per_roll_m} m` : '—'),
    row('No. of Rolls', i.no_of_rolls != null ? i.no_of_rolls : '—'),
    row('Total Length', d.total_length_m != null ? `${d.total_length_m.toFixed(2)} m` : '—'),
    row('Reel Type', s.packing?.code ?? i.reel_packing_id ?? '—'),
    row('Freight Included', i.freight_included ? 'Yes' : 'No'),
    row('Freight Destination', freight),
    row('Freight Rate Used', s.freight?.rate_per_kg != null ? `₹${s.freight.rate_per_kg.toFixed(2)} / ${s.freight.cost_type ?? 'KG'}` : '—'),

    hdr('Commercial'),
    row('COP Rate', i.cop_rate_per_kg != null ? `₹${i.cop_rate_per_kg} / kg` : '—'),
    row('Expense per KG', i.ovr_expenses_per_kg != null ? `₹${i.ovr_expenses_per_kg} / kg` : '—'),
    row('GP %', p.gp_pct_applied != null ? `${(p.gp_pct_applied * 100).toFixed(1)}%` : '—'),
    row('Exchange Rate', i.exchange_rate ? `₹${i.exchange_rate.toFixed(2)} / USD` : 'N/A'),

    hdr('Effective Dimensions & Factors'),
    row('Effective Width (W_eff)', d.effective_width_m != null ? `${d.effective_width_m.toFixed(4)} m` : '—'),
    row('Effective Length (L_eff)', d.effective_length_m != null ? `${d.effective_length_m.toFixed(3)} m` : '—'),
    row('Width Factor', d.width_factor != null ? d.width_factor.toFixed(4) : '—'),
    row('Length Factor', d.length_factor != null ? d.length_factor.toFixed(4) : '—'),

    hdr('Weight Breakdown'),
    row('Actual Weight / Meter',    d.actual_weight_per_meter_kg != null ? formatKg(d.actual_weight_per_meter_kg) + ' / m' : '—'),
    row('Calc. Weight / Meter',     d.calc_weight_per_meter_kg   != null ? formatKg(d.calc_weight_per_meter_kg)   + ' / m' : '—'),
    row('Total Actual Belt Weight', d.total_actual_weight_kg     != null ? formatKg(d.total_actual_weight_kg)              : '—'),
    row('Total Calc. Belt Weight',  d.total_calc_weight_kg       != null ? formatKg(d.total_calc_weight_kg)                : '—'),
    row('Fabric Weight', d.fabric_weight_kg != null ? formatKg(d.fabric_weight_kg) : '—'),
    row('Top Cover Weight', d.top_cover_weight_kg != null ? formatKg(d.top_cover_weight_kg) : '—'),
    row('Bottom Cover Weight', d.bottom_cover_weight_kg != null ? formatKg(d.bottom_cover_weight_kg) : '—'),
    row('Skim Weight', d.skim_weight_kg != null ? formatKg(d.skim_weight_kg) : '—'),
    row('Breaker Top Weight', d.breaker_top_weight_kg > 0 ? formatKg(d.breaker_top_weight_kg + d.breaker_top_skim_weight_kg) : '—'),
    row('Breaker Bot Weight', d.breaker_bot_weight_kg > 0 ? formatKg(d.breaker_bot_weight_kg + d.breaker_bot_skim_weight_kg) : '—'),
    row('Compound Weight (all rubber)', d.compound_weight_kg != null ? formatKg(d.compound_weight_kg) : '—'),
    row('Compound GSM', d.compound_gsm != null ? `${d.compound_gsm.toFixed(1)} g/m²` : '—'),

    hdr('Cost Breakdown'),
    row('Fabric Cost', c.fabric_cost != null ? formatRupees(c.fabric_cost) : '—'),
    row('Top Cover Cost', c.top_cover_cost != null ? formatRupees(c.top_cover_cost) : '—'),
    row('Bottom Cover Cost', c.bottom_cover_cost != null ? formatRupees(c.bottom_cover_cost) : '—'),
    row('Skim Cost', c.skim_cost != null ? formatRupees(c.skim_cost) : '—'),
    row('BOT Cost (fabric + skim)', (c.breaker_top_cost > 0 || c.breaker_top_skim_cost > 0) ? formatRupees((c.breaker_top_cost ?? 0) + (c.breaker_top_skim_cost ?? 0)) : '—'),
    row('BOB Cost (fabric + skim)', (c.breaker_bot_cost > 0 || c.breaker_bot_skim_cost > 0) ? formatRupees((c.breaker_bot_cost ?? 0) + (c.breaker_bot_skim_cost ?? 0)) : '—'),
    row('Total Compound Cost', c.total_compound_cost != null ? formatRupees(c.total_compound_cost) : '—'),
    row('Compound Price / kg', c.compound_price_per_kg != null ? formatRupees(c.compound_price_per_kg) + ' / kg' : '—'),
    row('Compound Factor (of Mat. Cost)', compoundFactor),
    row('Fabric + BOT + BOB Cost / m', c.fabric_plus_breaker_cost_per_m != null ? formatRupees(c.fabric_plus_breaker_cost_per_m) + ' / m' : '—'),
    row('Material Cost', c.material_cost != null ? formatRupees(c.material_cost) : '—'),
    row('Cost of Production (total)', c.cost_of_production != null ? formatRupees(c.cost_of_production) : '—'),
    row('COP / Meter', c.cop_per_m != null ? formatRupees(c.cop_per_m) + ' / m' : '—'),
    row('Crate / Packing Cost / Meter', c.crate_cost_per_m != null ? formatRupees(c.crate_cost_per_m) + ' / m' : '—'),
    row('Reel Cost / Meter', c.reel_cost_per_m != null && c.reel_cost_per_m > 0 ? formatRupees(c.reel_cost_per_m) + ' / m' : '—'),
    row('Freight Cost (total)', c.freight_cost != null ? formatRupees(c.freight_cost) : '—'),
    row('Total Belt Cost', c.total_belt_cost != null ? formatRupees(c.total_belt_cost) : '—'),

    hdr('Pricing'),
    row('Min. Quoting Price / m (RMC)', p.rmc_per_meter != null ? formatRupees(p.rmc_per_meter) + ' / m' : '—'),
    row('RMC With GP / m', p.rmc_with_gp_per_m != null ? formatRupees(p.rmc_with_gp_per_m) + ' / m' : '—'),
    row('Min Quotation RMC / m', p.min_quotation_rmc_per_m != null ? formatRupees(p.min_quotation_rmc_per_m) + ' / m' : '—'),
    row('Per mm Running Price (pre-quote)', p.per_mm_running_price_pre_quote != null ? formatRupees(p.per_mm_running_price_pre_quote) + ' / mm' : '—'),
    row('Material Cost / m (RMC VD)', c.material_cost_per_m != null ? formatRupees(c.material_cost_per_m) + ' / m' : '—'),
    row('Selling Price / m (CD)', p.cd_price_per_meter != null ? formatRupees(p.cd_price_per_meter) + ' / m' : '—'),
    row('Selling Price / m (VD)', p.vd_price_per_meter != null ? formatRupees(p.vd_price_per_meter) + ' / m' : '—'),
    row('Per mm of Width (VD)', p.per_mm_vd_price != null ? formatRupees(p.per_mm_vd_price) + ' / m / mm' : '—'),
    row('GP Value (CD)', p.gp_value_cd != null ? formatRupees(p.gp_value_cd) : '—'),
    row('CD Total (full order)', p.cd_total != null ? formatRupees(p.cd_total) : '—'),
    row('VD Total (full order)', p.vd_total != null ? formatRupees(p.vd_total) : '—'),
    row('Discount %', i.discount_pct != null ? `${(i.discount_pct * 100).toFixed(1)}%` : '0%'),
    row('Final CD / Meter', p.cd_final_per_meter != null ? formatRupees(p.cd_final_per_meter) + ' / m' : '—'),
    row('Final CD Total', p.cd_final_total != null ? formatRupees(p.cd_final_total) : '—'),
    row('Min. Quotation Price / m (USD)', p.rmc_usd != null ? `$${p.rmc_usd.toFixed(2)} / m` : 'N/A'),
    row('Quotation Rate / m USD (CD)', p.quotation_usd != null ? `$${p.quotation_usd.toFixed(2)} / m` : 'N/A'),
    row('Quotation Rate / m USD (VD)', p.quotation_vd_usd != null ? `$${p.quotation_vd_usd.toFixed(2)} / m` : 'N/A'),
    row('Total RMC Amount', c.total_belt_cost != null ? formatRupees(c.total_belt_cost) : '—'),
    row('Total Quotation Amount (CD)', p.cd_total != null ? formatRupees(p.cd_total) : '—'),
    row('Total RMC Cost VD (Material)', c.material_cost != null ? formatRupees(c.material_cost) : '—'),
    row('Total Quotation Cost VD', p.vd_total != null ? formatRupees(p.vd_total) : '—'),
    row('Per MM Price (CD)', widthMm > 0 && p.cd_price_per_meter ? formatRupees(p.cd_price_per_meter / widthMm) + ' / m / mm' : '—'),
    row('Per MM Price (VD)', p.per_mm_vd_price != null ? formatRupees(p.per_mm_vd_price) + ' / m / mm' : '—'),
    row('Freight Charges (Old Pricing)', '₹0 — legacy reference'),

  ];

  target.innerHTML = sections.join('');
}

function getSelectLabel(container, name) {
  const el = container.querySelector(`[name="${name}"]`);
  if (!el) return '—';
  if (el.type === 'hidden') return el.dataset.label || el.value || '—';
  const opt = el.options?.[el.selectedIndex];
  return opt ? opt.textContent.trim() : el.value || '—';
}

function showRow(container, rowId, valId, value, factor, factorId) {
  const row = container.querySelector(rowId);
  if (!row) return;
  if (value > 0) {
    row.style.display = '';
    setText(container, valId, formatKg(value));
    if (factorId) setText(container, factorId, factor);
  } else {
    row.style.display = 'none';
  }
}

function showCostRow(container, rowId, valId, value) {
  const row = container.querySelector(rowId);
  if (!row) return;
  if (value > 0) {
    row.style.display = '';
    setText(container, valId, formatRupees(value));
  } else {
    row.style.display = 'none';
  }
}

function setText(container, sel, text) {
  const el = container.querySelector(sel);
  if (el) el.textContent = text;
}

// ─── Send for Approval modal ──────────────────────────────────────────────────

function _showApprovalModal(container, quotation) {
  const existing = container.querySelector('#approval-modal');
  if (existing) existing.remove();

  const q = quotation ?? {};
  const refLabel = q.id ? `Ref: ${q.id}` : 'unsaved draft';

  const overlay = document.createElement('div');
  overlay.id = 'approval-modal';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;
    display:flex;align-items:center;justify-content:center;
  `;

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:8px;padding:28px 32px;width:380px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.25);">
      <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;">Send for Approval</h3>
      <p style="margin:0 0 16px;font-size:13px;color:#555;">${refLabel}</p>
      <div style="background:#fef9e7;border:1px solid #f0c040;border-radius:6px;padding:12px 14px;font-size:13px;color:#7a6000;margin-bottom:20px;">
        <strong>Coming soon</strong> — approver email address is not yet configured.<br>
        Once configured, this will send the PDF quotation to the approver inbox.
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-outline" id="approval-close">Close</button>
      </div>
    </div>
  `;

  container.appendChild(overlay);
  overlay.querySelector('#approval-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ─── Events ────────────────────────────────────────────────────────────────────

function setupEvents(container, quotation, isRevise) {
  setupWidthCombobox(container);

  // KPI rail breakdown tabs
  container.querySelectorAll('.qf-bd-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      container.querySelectorAll('.qf-bd-tab').forEach(b => b.classList.toggle('on', b === btn));
      container.querySelectorAll('.qf-bd-panel').forEach(p => p.classList.toggle('on', p.id === `tab-${tab}`));
    });
  });

  // Phase card collapse/expand
  container.querySelectorAll('.qf-phase-head').forEach(head => {
    head.addEventListener('click', () => {
      head.closest('.qf-phase').classList.toggle('qf-collapsed');
    });
  });

  // Stepper navigation
  container.querySelectorAll('.qf-step[data-qphase]').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = btn.dataset.qphase;
      const phase = container.querySelector(`#qf-ph-${n}`);
      if (!phase) return;
      phase.classList.remove('qf-collapsed');
      phase.scrollIntoView({ behavior: 'smooth', block: 'start' });
      container.querySelectorAll('.qf-step').forEach(s => s.classList.toggle('qf-step-active', s === btn));
    });
  });

  // Cover sub-tabs (Top / Bottom / Skim)
  container.querySelectorAll('[data-cvrtab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const panel = tab.dataset.cvrtab;
      container.querySelectorAll('[data-cvrtab]').forEach(t => t.classList.toggle('on', t === tab));
      container.querySelectorAll('[data-cvrpanel]').forEach(p => p.classList.toggle('on', p.dataset.cvrpanel === panel));
    });
  });

  // Unit type toggle
  container.querySelector('#unit-toggle')?.querySelectorAll('.qf-unit-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.closest('#unit-toggle').dataset.ro) return;
      const val = btn.dataset.unit;
      container.querySelectorAll('#unit-toggle .qf-unit-opt').forEach(b => b.classList.toggle('on', b === btn));
      const hidden = container.querySelector('[name="unit_system"]');
      if (hidden) hidden.value = val;
      recalc(container);
    });
  });

  // Belt construction type toggle (Open-End / Endless)
  container.querySelector('#end-type-toggle')?.querySelectorAll('.qf-unit-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.closest('#end-type-toggle').dataset.ro) return;
      const val = btn.dataset.unit;
      container.querySelectorAll('#end-type-toggle .qf-unit-opt').forEach(b => b.classList.toggle('on', b === btn));
      const hidden = container.querySelector('[name="open_end_type"]');
      if (hidden) hidden.value = val;
      const lengthRow = container.querySelector('#endless-length-row');
      if (lengthRow) lengthRow.style.display = val === 'ENDLESS' ? 'block' : 'none';
      recalc(container);
    });
  });

  // Belt edge type toggle (Cut Edge / Moulded / Vulcanised)
  container.querySelector('#edge-type-toggle')?.querySelectorAll('.qf-unit-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.closest('#edge-type-toggle').dataset.ro) return;
      const val = btn.dataset.unit;
      container.querySelectorAll('#edge-type-toggle .qf-unit-opt').forEach(b => b.classList.toggle('on', b === btn));
      const hidden = container.querySelector('[name="edge_id"]');
      if (hidden) hidden.value = val;
      recalc(container);
    });
  });

  if (_isReadOnly) return;

  // All inputs → recalc
  container.querySelectorAll('select, input[type="number"], input[type="text"]:not([readonly]):not([disabled])').forEach(el => {
    el.addEventListener('change', () => recalc(container));
    if (el.tagName === 'INPUT') el.addEventListener('input', () => recalc(container));
  });

  // Fabric type → repopulate strength/ply + refresh derived fields
  container.querySelector('[name="fabric_type"]')?.addEventListener('change', e => {
    populateFabricStrengthDropdowns(container, e.target.value, null, null, null);
    updateBeltRating(container);
    updateDerivedDisplays(container, null);
  });

  // Customer change → auto-fill GP% from customer default, update enquiry choices
  container.querySelector('[name="customer_id"]')?.addEventListener('change', e => {
    const { customer_id: selectedCustomerId } = parseOptionKey(e.target.value);

    // Auto-fill GP% from the selected customer's default_gp_pct
    const customer = selectedCustomerId ? getCustomer(selectedCustomerId) : null;
    const gpInput = container.querySelector('[name="gp_pct_direct"]');
    if (gpInput && customer?.default_gp_pct != null) {
      gpInput.value = customer.default_gp_pct;
      const warnEl = container.querySelector('#gp-low-warning');
      if (warnEl) warnEl.style.display = customer.default_gp_pct < 20 ? 'flex' : 'none';
      recalc(container);
    }

    const enquiryEl = container.querySelector('[name="enquiry_id"]');
    if (!enquiryEl) return;
    const enquiries = storageGetAll('enquiry.').filter(enq => enq.customer_id === selectedCustomerId);
    const currentEnquiryId = enquiryEl.value;
    pop(container, '[name="enquiry_id"]', enquiries, 'id', 'id', enquiries.some(enq => enq.id === currentEnquiryId) ? currentEnquiryId : '', true);
    updateEnquiryDescription(container, enquiryEl.value);
  });

  // Enquiry change → update description display
  container.querySelector('[name="enquiry_id"]')?.addEventListener('change', e => {
    updateEnquiryDescription(container, e.target.value);
  });

  // Belt rating + derived fabric field refresh on fabric selection changes
  ['fabric_type', 'fabric_strength', 'plies', 'top_cover_thickness_mm', 'bottom_cover_thickness_mm', 'customer_carcass_thickness_mm'].forEach(n => {
    container.querySelector(`[name="${n}"]`)?.addEventListener('change', () => {
      updateBeltRating(container);
      updateDerivedDisplays(container, null);
    });
  });
  container.querySelector('[name="customer_carcass_thickness_mm"]')?.addEventListener('input', () => {
    updateDerivedDisplays(container, null);
  });

  // Top cover compound → auto-fill SG+rate, auto-suggest skim, update match display
  container.querySelector('[name="top_cover_compound_id"]')?.addEventListener('change', e => {
    const cmpd = getLiveCompounds().find(r => r.id === e.target.value);
    const sgEl   = container.querySelector('[name="ovr_sg_top"]');
    const rateEl = container.querySelector('[name="ovr_cover_rate_top"]');
    if (sgEl)   sgEl.value   = cmpd?.sg           ?? '';
    if (rateEl) rateEl.value = cmpd?.price_per_kg ?? '';
    const compat = COVER_SKIM_COMPATIBILITY?.find(c => c.cover_grade_family === cmpd?.grade_family);
    if (compat) {
      const skimSel    = container.querySelector('[name="skim_compound_id"]');
      const skimRateEl = container.querySelector('[name="ovr_skim_rate"]');
      if (skimSel && !skimSel.value) {
        skimSel.value = compat.skim_compound_id;
        if (skimRateEl && !skimRateEl.value) {
          const skimCmpd = getLiveCompounds().find(r => r.id === compat.skim_compound_id);
          skimRateEl.value = skimCmpd?.price_per_kg ?? '';
        }
      }
    }
    updateSkimMatchDisplay(container);
    recalc(container);
  });

  // Bottom cover compound → auto-fill SG+rate
  container.querySelector('[name="bottom_cover_compound_id"]')?.addEventListener('change', e => {
    const cmpd = getLiveCompounds().find(r => r.id === e.target.value);
    const sgEl   = container.querySelector('[name="ovr_sg_bottom"]');
    const rateEl = container.querySelector('[name="ovr_cover_rate_bottom"]');
    if (sgEl)   sgEl.value   = cmpd?.sg           ?? '';
    if (rateEl) rateEl.value = cmpd?.price_per_kg ?? '';
    recalc(container);
  });

  // Skim compound → auto-fill rate, update match display
  container.querySelector('[name="skim_compound_id"]')?.addEventListener('change', e => {
    const cmpd   = getLiveCompounds().find(r => r.id === e.target.value);
    const rateEl = container.querySelector('[name="ovr_skim_rate"]');
    if (rateEl) rateEl.value = cmpd?.price_per_kg ?? '';
    updateSkimMatchDisplay(container);
    recalc(container);
  });

  // Product type → repopulate belt types
  container.querySelector('[name="product_type_id"]')?.addEventListener('change', e => {
    populateBeltTypes(container, e.target.value, null);
    recalc(container);
  });

  // Belt type → auto-fill COP rate from master
  container.querySelector('[name="belt_type_id"]')?.addEventListener('change', () => {
    autoFillCopRate(container);
    recalc(container);
  });


  // Generic Yes/No pill toggles
  container.querySelectorAll('.qf-yn-toggle').forEach(tog => {
    tog.querySelectorAll('.qf-unit-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        if (tog.dataset.ro) return;
        const val = btn.dataset.unit;
        tog.querySelectorAll('.qf-unit-opt').forEach(b => b.classList.toggle('on', b === btn));
        const hidden = tog.nextElementSibling;
        if (hidden) hidden.value = val;
        const targetId = tog.dataset.target;
        if (targetId) {
          const sub = container.querySelector(`#${targetId}`);
          if (sub) sub.style.display = val === 'yes' ? 'block' : 'none';
        }
        if (targetId === 'breaker-top-sub' || targetId === 'breaker-bot-sub') updateDerivedDisplays(container, null);
        if (targetId === 'discount-fields' && _currentResult) updateDiscountResults(container, _currentResult);
        recalc(container);
      });
    });
  });

  // Packing type → update packing cost display
  container.querySelector('[name="packing_type_id"]')?.addEventListener('change', () => updateDerivedDisplays(container, null));

  // Reel type → update reel cost display
  container.querySelector('[name="reel_type_id"]')?.addEventListener('change', () => updateDerivedDisplays(container, null));

  // Freight destination → auto-fill rate
  container.querySelector('[name="freight_id"]')?.addEventListener('change', e => {
    const row = getLiveFreight().find(r => r.id === e.target.value);
    const input = container.querySelector('[name="freight_cost_override"]');
    if (input && row) input.value = row.rate_per_kg.toFixed(2);
    recalc(container);
  });

  // Discount price type or % change → update final price display
  ['discount_price_type', 'discount_pct_input'].forEach(n => {
    container.querySelector(`[name="${n}"]`)?.addEventListener('change', () => {
      if (_currentResult) updateDiscountResults(container, _currentResult);
    });
  });

  // Currency change → auto-fill exchange rate from master, update unit label
  const currencyEl = container.querySelector('[name="currency_id"]');
  if (currencyEl) {
    currencyEl.addEventListener('change', () => {
      const currencies = getAllCurrencies();
      const cur = currencies.find(c => c.id === currencyEl.value);
      _updateExchangeRateUnit(container, currencies, currencyEl.value);
      const rateEl = container.querySelector('[name="exchange_rate"]');
      if (rateEl && cur?.exchange_rate != null) {
        rateEl.value = cur.exchange_rate;
      }
      recalc(container);
    });
  }

  // GP% — soft warning + confirmation when user sets below 20%
  const GP_FLOOR = 20;
  const gpInput = container.querySelector('[name="gp_pct_direct"]');
  if (gpInput) {
    gpInput.addEventListener('change', () => {
      const val = parseFloat(gpInput.value);
      const warnEl = container.querySelector('#gp-low-warning');
      if (!isNaN(val) && val < GP_FLOOR) {
        const confirmed = confirm(
          `GP% is set to ${val}%, which is below the minimum of ${GP_FLOOR}%.\n\nDo you want to allow GP below ${GP_FLOOR}%?\n\nClick OK to proceed with ${val}%,\nor Cancel to revert to ${GP_FLOOR}%.`
        );
        if (!confirmed) {
          gpInput.value = GP_FLOOR;
          if (warnEl) warnEl.style.display = 'none';
          recalc(container);
          return;
        }
        if (warnEl) warnEl.style.display = 'flex';
      } else {
        if (warnEl) warnEl.style.display = 'none';
      }
      recalc(container);
    });
  }

  // Grade-family chips (§8.6) — filter cover compound dropdowns
  container.querySelectorAll('#grade-chips-cover .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      _gradeFilter = chip.dataset.gradeFilter ?? 'ALL';
      container.querySelectorAll('#grade-chips-cover .chip').forEach(c => c.classList.toggle('active', c === chip));
      // Re-populate cover compound selects with filter applied
      const line = collectLine(container);
      const _CMPD = getLiveCompounds();
      const isCoverRole = r => { const rs = r.roles?.split('|') ?? []; return rs.includes('TOP_COVER') || rs.includes('BOTTOM_COVER'); };
      const allCover   = _CMPD.filter(r => r.active !== false && isCoverRole(r));
      const coverCmpds = _gradeFilter === 'ALL' ? allCover : allCover.filter(r => r.grade_family === _gradeFilter);
      pop(container, '[name="top_cover_compound_id"]',    coverCmpds, 'id', 'name', line.top_cover_compound_id);
      pop(container, '[name="bottom_cover_compound_id"]', coverCmpds, 'id', 'name', line.bottom_cover_compound_id);
      recalc(container);
    });
  });

  // Overrides collapsible toggle (§8.7)
  container.querySelector('#overrides-toggle')?.addEventListener('click', () => {
    const body  = container.querySelector('#overrides-body');
    const caret = container.querySelector('#overrides-caret');
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display  = open ? 'none' : 'block';
    if (caret) caret.textContent = open ? '▶' : '▼';
  });

  // Post-order collapsible toggle (§8.12)
  container.querySelector('#post-order-toggle')?.addEventListener('click', () => {
    const body  = container.querySelector('#post-order-body');
    const caret = container.querySelector('#post-order-caret');
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display  = open ? 'none' : 'block';
    if (caret) caret.textContent = open ? '▶' : '▼';
  });

  // Custom width modal
  container.querySelector('#btn-custom-width')?.addEventListener('click', () => {
    container.querySelector('#custom-width-modal').style.display = 'flex';
  });
  container.querySelector('#btn-cancel-custom-width')?.addEventListener('click', () => {
    container.querySelector('#custom-width-modal').style.display = 'none';
  });
  container.querySelector('#btn-submit-custom-width')?.addEventListener('click', () => {
    const w    = container.querySelector('#custom-width-input').value;
    const note = container.querySelector('#custom-width-note').value;
    if (!w) return;
    const reqId = `WR-${Date.now()}`;
    storageSet(`width_request.${reqId}`, { id: reqId, width_mm: Number(w), note, status: 'pending', created_at: new Date().toISOString() });
    container.querySelector('#custom-width-modal').style.display = 'none';
    showToast(`Custom width request ${w} mm submitted. Awaiting Admin approval.`);
  });

  // Save / Send
  container.querySelector('#btn-save')?.addEventListener('click', () => saveQuotation(container, quotation, 'draft', isRevise));
  container.querySelector('#btn-send')?.addEventListener('click', () => {
    if (!_currentResult) { showToast('Complete all required fields first — results update live.'); return; }
    const gpVal = parseFloat(container.querySelector('[name="gp_pct_direct"]')?.value);
    const lowGp = !isNaN(gpVal) && gpVal < 20;
    const msg = lowGp
      ? `GP% is ${gpVal}%, BELOW the 20% minimum.\n\nSending needs approval and will freeze all rates permanently.\n\nApprove and proceed?`
      : 'Mark as Sent? All rates will be frozen permanently.';
    if (confirm(msg)) {
      saveQuotation(container, quotation, 'sent', isRevise);
    }
  });
  container.querySelector('#btn-back')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('ravasco:navigate', { detail: { view: 'quotations' } }));
  });
  container.querySelector('#btn-pdf')?.addEventListener('click', () => {
    if (!_currentResult) { showToast('No calculation result found — fill in all required fields first.'); return; }
    openPrintWindow(_currentQuotation, _currentResult);
  });
  container.querySelector('#btn-approve')?.addEventListener('click', () => {
    if (!_currentResult) { showToast('Complete all required fields first — results update live.'); return; }
    _showApprovalModal(container, _currentQuotation);
  });
  container.querySelector('#btn-email')?.addEventListener('click', () => {
    if (!_currentResult) { showToast('No calculation result found — open the quotation and recalculate first.'); return; }
    openEmailModal(_currentQuotation, _currentResult);
  });
  container.querySelector('#btn-revise-btn')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('ravasco:navigate', { detail: { view: 'quotations', action: 'revise', id: _currentQuotation?.id } }));
  });

  // WON / LOST lifecycle buttons
  container.querySelector('#btn-won')?.addEventListener('click', () => {
    if (confirm('Mark this quotation as WON?')) markOutcome(quotation, 'won');
  });
  container.querySelector('#btn-lost')?.addEventListener('click', () => {
    if (confirm('Mark this quotation as LOST?')) markOutcome(quotation, 'lost');
  });
}

// ─── Save ──────────────────────────────────────────────────────────────────────

function saveQuotation(container, quotation, status, isRevise) {
  const customerOptionKey = container.querySelector('[name="customer_id"]')?.value;
  if (!customerOptionKey) { showToast('Select a customer first.'); return; }
  const { customer_id: customerId, location_id: customerLocationId } = parseOptionKey(customerOptionKey);

  const line      = collectLine(container);
  const isSending = status === 'sent';
  if (isSending && !_currentResult) { showToast('Complete all required fields first — results must be live before sending.'); return; }

  const lineWithResult = { ...line, result: _currentResult };
  if (isSending && _currentResult) {
    lineWithResult.frozen_snapshot = _currentResult.snapshot;
    lineWithResult.frozen_at       = new Date().toISOString();
  }

  const existingId = quotation?.id;
  const qtnId = existingId ?? nextQuotationId();

  const record = {
    id:           qtnId,
    customer_id:  customerId,
    location_id:  customerLocationId ?? null,
    enquiry_id:   container.querySelector('[name="enquiry_id"]')?.value || null,
    special_note: container.querySelector('[name="special_note"]')?.value?.trim() || null,
    status,
    lines:        [lineWithResult],
    warnings:     _currentResult?.warnings ?? [],
    created_at:   quotation?.created_at ?? new Date().toISOString(),
    updated_at:   new Date().toISOString(),
    ...(isSending ? { sent_at: new Date().toISOString() } : {}),
  };

  storageSet(`quotation.${qtnId}`, record);
  auditLog({ entity: 'quotation', entity_id: qtnId, action: isSending ? 'sent' : isRevise ? 'revised' : (existingId ? 'edited' : 'created'), diff: { status } });
  if (isSending && line.gp_pct_direct != null && Number(line.gp_pct_direct) < 20) {
    auditLog({ entity: 'quotation', entity_id: qtnId, action: 'override_applied', diff: { gp_pct: Number(line.gp_pct_direct), floor: 20, note: 'GP below 20% minimum — approved at send' } });
  }
  showToast(isSending ? `Quotation ${qtnId} sent and frozen.` : `Quotation ${qtnId} saved as draft.`);
  window.dispatchEvent(new CustomEvent('ravasco:navigate', { detail: { view: 'quotations', action: 'view', id: qtnId } }));
}

// ─── WON / LOST outcome ───────────────────────────────────────────────────────

function markOutcome(quotation, outcome) {
  if (!quotation?.id) return;
  const record = storageGet(`quotation.${quotation.id}`) ?? quotation;
  record.status     = outcome;
  record.updated_at = new Date().toISOString();
  if (outcome === 'won')  record.won_at  = new Date().toISOString();
  if (outcome === 'lost') record.lost_at = new Date().toISOString();
  storageSet(`quotation.${quotation.id}`, record);
  auditLog({ entity: 'quotation', entity_id: quotation.id, action: outcome, diff: { status: outcome } });
  showToast(`Quotation ${quotation.id} marked as ${outcome.toUpperCase()}.`);
  window.dispatchEvent(new CustomEvent('ravasco:navigate', { detail: { view: 'quotations', action: 'view', id: quotation.id } }));
}

// ─── Lock / Revise ─────────────────────────────────────────────────────────────

function lockForm(container) {
  container.querySelectorAll('select, input, button').forEach(el => {
    if (['btn-back', 'btn-revise-btn', 'btn-pdf', 'btn-email', 'btn-won', 'btn-lost'].includes(el.id)) return;
    if (el.classList.contains('qf-bd-tab')) return;
    if (el.classList.contains('qf-step')) return;
    if (el.closest('.qf-phase-head')) return;
    if (el.closest('[data-cvrtab]')) return;
    el.disabled = true;
  });
}

function createRevision(original) {
  const baseId    = original.id.replace(/-R\d+$/, '');
  const match     = original.id.match(/-R(\d+)$/);
  const newRevNum = match ? parseInt(match[1]) + 1 : 1;
  return {
    ...original,
    id:                   revisionId(baseId, newRevNum),
    status:               'draft',
    previous_revision_id: original.id,
    created_at:           new Date().toISOString(),
    lines: (original.lines ?? []).map(l => ({ ...l, frozen_snapshot: undefined, frozen_at: undefined, result: undefined })),
  };
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function showToast(msg) {
  window.dispatchEvent(new CustomEvent('ravasco:toast', { detail: { msg } }));
}
