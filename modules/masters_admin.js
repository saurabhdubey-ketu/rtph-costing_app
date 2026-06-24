// modules/masters_admin.js
// Masters Administration — Phase 0: full CRUD for all master tables.
// Compounds, Breakers, Freight, Packing, Edge: Add / Edit / Archive.
// Compound: tracks price history on every price_per_kg change.
// Belt Types, Fabric/Belt Ratings, GP Bands: read-only in v1 (per spec §14.1).

import { storageGetAll, storageGet, storageSet } from '../lib/storage.js';
import { auditLog }      from '../lib/audit.js';
import {
  getLiveCompounds, getLiveBreakers, getLivePacking, getLiveFreight, getLiveEdges,
  saveMasterEntry, archiveMasterEntry, restoreMasterEntry,
  getPriceHistory, generateMasterId,
} from '../lib/master_store.js';
import { FABRIC_STRENGTH_MASTER } from '../masters/fabric_strength_master.js';
import { FABRIC_RATE_MASTER }    from '../masters/fabric_rate_master.js';
import { BELT_TYPE_MASTER }       from '../masters/belt_type_master.js';
import { GP_MASTER }              from '../masters/gp_master.js';
import {
  saveCurrency, getCurrency, getAllCurrencies, deactivateCurrency, initCurrencyDefaults,
} from '../masters/currency_master.js';

// ── Module-level state ────────────────────────────────────────────────────────
let _container   = null;   // root container
let _activeTab   = 'compounds';
let _modalSaveFn = null;   // callback set by showModal()

// ── Entry point ───────────────────────────────────────────────────────────────
export function renderMastersAdmin(container) {
  _container = container;
  container.innerHTML = `
    <div class="page-header">
      <h2>Masters Administration</h2>
      <p class="page-subtitle">All rates, specs and lookup values for the costing engine. Changes take effect on the next quotation. Sent quotations remain frozen on their snapshot.</p>
    </div>
    <div class="tab-bar" id="master-tab-bar">
      <button class="tab-btn active"  data-tab="compounds">Compounds</button>
      <button class="tab-btn"         data-tab="fabrics">Belt Ratings</button>
      <button class="tab-btn"         data-tab="belt-types">Belt Types</button>
      <button class="tab-btn"         data-tab="breakers">Breakers</button>
      <button class="tab-btn"         data-tab="freight">Freight</button>
      <button class="tab-btn"         data-tab="packing">Packing</button>
      <button class="tab-btn"         data-tab="gp">GP Bands</button>
      <button class="tab-btn"         data-tab="edge">Belt Construction Types</button>
      <button class="tab-btn"         data-tab="currency">Currency</button>
      <button class="tab-btn"         data-tab="width-requests">Width Requests</button>
    </div>
    <div id="master-tab-content"></div>

    <!-- Shared modal -->
    <div id="master-modal" class="modal" style="display:none">
      <div class="modal-box modal-box-lg">
        <div class="modal-header">
          <h3 id="master-modal-title">—</h3>
          <button id="master-modal-close" class="btn btn-ghost btn-sm">✕</button>
        </div>
        <div id="master-modal-body"></div>
        <div class="modal-footer">
          <button id="master-modal-save"   class="btn btn-accent">Save</button>
          <button id="master-modal-cancel" class="btn btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  `;

  // Tab click
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _activeTab = btn.dataset.tab;
      showTab(btn.dataset.tab);
    });
  });

  // Modal close buttons
  container.querySelector('#master-modal-close')?.addEventListener('click',  closeModal);
  container.querySelector('#master-modal-cancel')?.addEventListener('click', closeModal);
  container.querySelector('#master-modal-save')?.addEventListener('click', () => {
    if (_modalSaveFn) _modalSaveFn();
  });
  // Click outside modal-box → close
  container.querySelector('#master-modal')?.addEventListener('click', e => {
    if (e.target === container.querySelector('#master-modal')) closeModal();
  });

  initCurrencyDefaults();
  showTab('compounds');
}

// ── Tab router ────────────────────────────────────────────────────────────────
function showTab(tab) {
  const area = document.getElementById('master-tab-content');
  if (!area) return;
  try {
    switch (tab) {
      case 'compounds':      area.innerHTML = renderCompoundsTable(); bindCompoundActions(area); break;
      case 'fabrics':        area.innerHTML = renderFabricsTable(); break;
      case 'belt-types':     area.innerHTML = renderBeltTypesTable(); break;
      case 'breakers':       area.innerHTML = renderBreakersTable(); bindBreakerActions(area); break;
      case 'freight':        area.innerHTML = renderFreightTable(); bindFreightActions(area); break;
      case 'packing':        area.innerHTML = renderPackingTable(); bindPackingActions(area); break;
      case 'gp':             area.innerHTML = renderGpTable(); break;
      case 'edge':           area.innerHTML = renderEdgeTable(); bindEdgeActions(area); break;
      case 'currency':       area.innerHTML = renderCurrencyTable(); bindCurrencyActions(area); break;
      case 'width-requests': renderWidthRequests(area); break;
    }
  } catch (err) {
    area.innerHTML = `<div class="master-table-wrap"><div class="alert-banner"><p>⚠ Error loading tab: ${escHtml(err.message)}</p></div></div>`;
    console.error('Masters tab error:', err);
  }
}

// ── Refresh tab in place ──────────────────────────────────────────────────────
function refreshTab() { showTab(_activeTab); }

// ── Modal helpers ─────────────────────────────────────────────────────────────
function showModal(title, bodyHTML, saveFn) {
  _modalSaveFn = saveFn;
  const modal = _container?.querySelector('#master-modal');
  if (!modal) return;
  modal.querySelector('#master-modal-title').textContent = title;
  modal.querySelector('#master-modal-body').innerHTML    = bodyHTML;
  const saveBtn = modal.querySelector('#master-modal-save');
  if (saveBtn) saveBtn.style.display = saveFn ? '' : 'none';
  modal.style.display = 'flex';
}
function closeModal() {
  const modal = _container?.querySelector('#master-modal');
  if (modal) {
    modal.style.display = 'none';
    const saveBtn = modal.querySelector('#master-modal-save');
    if (saveBtn) saveBtn.style.display = '';
  }
  _modalSaveFn = null;
}

// ── Utility: read form field from modal ──────────────────────────────────────
function mf(name) {
  const modal = _container?.querySelector('#master-modal');
  return modal?.querySelector(`[name="${name}"]`)?.value?.trim() ?? '';
}
function mfNum(name) {
  const v = mf(name);
  return v !== '' ? Number(v) : null;
}
function mfChecked(name) {
  const modal = _container?.querySelector('#master-modal');
  return modal?.querySelector(`[name="${name}"]`)?.checked ?? false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOUND MASTER  ⭐
// ═══════════════════════════════════════════════════════════════════════════════

function renderCompoundsTable() {
  const compounds = getLiveCompounds();
  const active    = compounds.filter(r => r.active !== false);
  const archived  = compounds.filter(r => r.active === false);
  return `
  <div class="master-table-wrap">
    <div class="master-table-header">
      <div>
        <h3>Compound Master <span class="master-note">(${active.length} active, ${archived.length} archived)</span></h3>
        <p class="master-info">Compound types for covers, skims, cleats, sidewalls. SG and ₹/kg are entered per-quotation in the costing form.</p>
      </div>
      <button class="btn btn-accent btn-sm" id="btn-add-compound">+ Add Compound</button>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Code</th><th>Name</th><th>Roles</th><th>Grade</th>
          <th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${compounds.map(r => `
          <tr class="${r.active !== false ? '' : 'row-inactive'}">
            <td class="mono">${escHtml(r.code)}</td>
            <td>${escHtml(r.name)}</td>
            <td class="mono" style="font-size:.75rem">${escHtml((r.roles ?? '—').replace(/\|/g, ' · '))}</td>
            <td>${escHtml(r.grade_family ?? '—')}</td>
            <td><span class="badge badge-${r.active !== false ? 'active' : 'archived'}">${r.active !== false ? 'Active' : 'Archived'}</span></td>
            <td class="table-actions">
              <button class="btn btn-sm btn-outline" data-action="edit-compound"   data-id="${escHtml(r.id)}">Edit</button>
              <button class="btn btn-sm btn-ghost"   data-action="history-compound" data-id="${escHtml(r.id)}">History</button>
              ${r.active !== false
                ? `<button class="btn btn-sm btn-danger-ghost" data-action="archive-compound" data-id="${escHtml(r.id)}">Archive</button>`
                : `<button class="btn btn-sm btn-ghost"        data-action="restore-compound" data-id="${escHtml(r.id)}">Restore</button>`}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function bindCompoundActions(area) {
  area.querySelector('#btn-add-compound')?.addEventListener('click', () => openCompoundModal(null));
  area.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    const id     = btn.dataset.id;
    if (action === 'edit-compound')    btn.addEventListener('click', () => openCompoundModal(id));
    if (action === 'history-compound') btn.addEventListener('click', () => openPriceHistoryModal(id));
    if (action === 'archive-compound') btn.addEventListener('click', () => {
      if (confirm(`Archive compound "${id}"? It will hide from new-quote pickers but remain on existing quotes.`)) {
        archiveMasterEntry('compound', id);
        auditLog({ entity: 'master.compound', entity_id: id, action: 'archived', diff: { active: false } });
        showToast(`Compound ${id} archived.`);
        refreshTab();
      }
    });
    if (action === 'restore-compound') btn.addEventListener('click', () => {
      restoreMasterEntry('compound', id);
      auditLog({ entity: 'master.compound', entity_id: id, action: 'restored', diff: { active: true } });
      showToast(`Compound ${id} restored.`);
      refreshTab();
    });
  });
}

function openCompoundModal(id) {
  const compounds = getLiveCompounds();
  const entry     = id ? compounds.find(r => r.id === id) : null;
  const isNew     = !entry;
  const newId     = isNew ? generateMasterId('compound') : entry.id;

  const ALL_ROLES = ['TOP_COVER','BOTTOM_COVER','SKIM','CUSHION','SIDEWALL','CLEAT','BLINKER','SOLUTION','HARDENER','EDGE'];
  const entryRoles = (entry?.roles ?? '').split('|').filter(Boolean);

  const rolesHTML = ALL_ROLES.map(r => `
    <label class="checkbox-label">
      <input type="checkbox" name="role_${r}" ${entryRoles.includes(r) ? 'checked' : ''}> ${r.replace(/_/g,' ')}
    </label>`).join('');

  showModal(isNew ? 'Add Compound' : `Edit Compound — ${entry.code}`, `
    <div class="modal-form-grid">
      <div class="form-group">
        <label>Code *</label>
        <input type="text" name="code" value="${escHtml(entry?.code ?? '')}" ${!isNew ? 'readonly' : ''} placeholder="e.g. M-24">
      </div>
      <div class="form-group">
        <label>Name *</label>
        <input type="text" name="name" value="${escHtml(entry?.name ?? '')}" placeholder="e.g. M-24 General Purpose Cover">
      </div>
      <div class="form-group form-group-full">
        <label>Roles * <span class="form-hint">(check all that apply)</span></label>
        <div class="checkbox-group">${rolesHTML}</div>
      </div>
      <div class="form-group">
        <label>Grade Family</label>
        <select name="grade_family">
          <option value="">— none —</option>
          ${['GP','AR','HR','FR','OR','COLD','LRR'].map(g => `<option value="${g}" ${entry?.grade_family === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Chemical Category</label>
        <input type="text" name="chemical_category" value="${escHtml(entry?.chemical_category ?? '')}">
      </div>
      <div class="form-group">
        <label>Polymer Base</label>
        <input type="text" name="polymer_base" value="${escHtml(entry?.polymer_base ?? '')}" placeholder="e.g. NR/SBR">
      </div>
      <div class="form-group">
        <label>Skim Usage</label>
        <select name="skim_usage">
          <option value="">— N/A (not a skim) —</option>
          <option value="FABRIC"        ${entry?.skim_usage === 'FABRIC'        ? 'selected' : ''}>FABRIC</option>
          <option value="STEEL_BREAKER" ${entry?.skim_usage === 'STEEL_BREAKER' ? 'selected' : ''}>STEEL_BREAKER</option>
          <option value="BOTH"          ${entry?.skim_usage === 'BOTH'          ? 'selected' : ''}>BOTH</option>
        </select>
      </div>
      <div class="form-group">
        <label>Brand Line</label>
        <input type="text" name="brand_line" value="${escHtml(entry?.brand_line ?? '')}" placeholder="e.g. Super Brute">
      </div>
      <div class="form-group form-group-full">
        <label>Notes</label>
        <textarea name="notes" rows="2">${escHtml(entry?.notes ?? '')}</textarea>
      </div>
    </div>
  `, () => {
    const modal = _container.querySelector('#master-modal');
    const roles = ALL_ROLES.filter(r => modal.querySelector(`[name="role_${r}"]`)?.checked);
    if (roles.length === 0) { showToast('Select at least one role.'); return; }
    const code = mf('code');
    if (!code) { showToast('Code is required.'); return; }
    const updated = {
      ...(entry ?? {}),
      id:                newId,
      code,
      name:              mf('name') || code,
      roles:             roles.join('|'),
      grade_family:      mf('grade_family') || null,
      chemical_category: mf('chemical_category') || null,
      polymer_base:      mf('polymer_base') || null,
      skim_usage:        mf('skim_usage') || null,
      brand_line:        mf('brand_line') || null,
      notes:             mf('notes') || null,
      active:            entry?.active !== false,
    };

    saveMasterEntry('compound', updated);
    auditLog({ entity: 'master.compound', entity_id: updated.id, action: isNew ? 'created' : 'edited', diff: {} });
    showToast(isNew ? `Compound ${updated.code} added.` : `Compound ${updated.code} saved.`);
    closeModal();
    refreshTab();
  });
}

function openPriceHistoryModal(compoundId) {
  const compounds = getLiveCompounds();
  const entry     = compounds.find(r => r.id === compoundId);
  const history   = getPriceHistory(compoundId);
  const rows = history.length === 0
    ? '<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted)">No price changes recorded yet.</td></tr>'
    : history.map(h => `
        <tr>
          <td class="mono">${h.ts?.replace('T',' ').slice(0,19)}</td>
          <td class="num">₹${Number(h.old_price).toFixed(2)}</td>
          <td class="num">₹${Number(h.new_price).toFixed(2)}</td>
          <td>${escHtml(h.actor ?? '—')}</td>
        </tr>`).join('');

  showModal(`Price History — ${entry?.code ?? compoundId}`, `
    <p style="margin-bottom:1rem">Current price: <strong>₹${(entry?.price_per_kg ?? 0).toFixed(2)}/kg</strong></p>
    <table class="data-table">
      <thead><tr><th>Timestamp</th><th class="num">Old ₹/kg</th><th class="num">New ₹/kg</th><th>Changed by</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `, null);  // null saveFn → showModal hides the Save button automatically
}

// ═══════════════════════════════════════════════════════════════════════════════
// FABRIC / BELT RATING MASTER  (read-only — price resolution via fabric_rate_master)
// ═══════════════════════════════════════════════════════════════════════════════

function renderFabricsTable() {
  return `
  <div class="master-table-wrap">
    <h3>Fabric / Belt Rating Master <span class="master-note">(${FABRIC_STRENGTH_MASTER.filter(r=>r.active).length} active)</span></h3>
    <p class="master-info">GSM and price resolved via Fabric Rate Master at quotation time. This table is the structural catalogue — read-only in v1.</p>
    <table class="data-table">
      <thead><tr><th>Code</th><th>Type</th><th>Strength (N/mm)</th><th>Plies</th><th>Per-Ply Rating</th><th>Carcass Thk (mm)</th><th class="num">Base Rate (₹/kg)</th><th>Status</th></tr></thead>
      <tbody>
        ${FABRIC_STRENGTH_MASTER.map(r => {
          const typeDef = FABRIC_RATE_MASTER.type_defaults.find(d => d.fabric_type === r.fabric_type);
          const baseRate = typeDef ? `₹${typeDef.default_rate_per_kg.toFixed(2)}` : '—';
          const carcass  = r.nominal_carcass_thickness_mm != null ? r.nominal_carcass_thickness_mm : '—';
          return `
          <tr class="${r.active ? '' : 'row-inactive'}">
            <td class="mono">${escHtml(r.code)}</td>
            <td>${r.fabric_type}</td>
            <td class="num">${r.total_strength}</td>
            <td class="num">${r.no_of_ply}</td>
            <td class="num">${r.per_ply_rating}</td>
            <td class="num">${carcass}</td>
            <td class="num">${baseRate}</td>
            <td>${r.active ? 'Active' : 'Archived'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BELT TYPE MASTER  (read-only in v1)
// ═══════════════════════════════════════════════════════════════════════════════

function renderBeltTypesTable() {
  const flags = ['has_top_cover','has_bottom_cover','has_fabric','has_skim','has_breaker','has_cleat','has_sidewall','has_blinker'];
  return `
  <div class="master-table-wrap">
    <h3>Belt Type Master <span class="master-note">(v1 read-only)</span></h3>
    <p class="master-info">Belt type component declarations drive form visibility and engine component selection. Edit via JS file in v1.</p>
    <table class="data-table" style="font-size:.8rem">
      <thead>
        <tr>
          <th>Code</th><th>Name</th><th>Family</th>
          ${flags.map(f=>`<th>${f.replace('has_','')}</th>`).join('')}
          <th>CoP ₹/kg</th><th>Phase</th>
        </tr>
      </thead>
      <tbody>
        ${BELT_TYPE_MASTER.map(r => `
          <tr class="${r.active ? '' : 'row-inactive'}">
            <td class="mono">${escHtml(r.code)}</td>
            <td>${escHtml(r.name)}</td>
            <td class="mono" style="font-size:.7rem">${escHtml(r.calc_family ?? '—')}</td>
            ${flags.map(f => `<td class="num">${r[f] ? '✓' : ''}</td>`).join('')}
            <td class="num">${r.cost_of_production_rate_per_kg ?? '—'}</td>
            <td class="num">${r.phase ?? '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BREAKER MASTER
// ═══════════════════════════════════════════════════════════════════════════════

function renderBreakersTable() {
  const breakers = getLiveBreakers();
  const active   = breakers.filter(r => r.active !== false);
  return `
  <div class="master-table-wrap">
    <div class="master-table-header">
      <div>
        <h3>Breaker Master <span class="master-note">(${active.length} active)</span></h3>
        <p class="master-info">Breaker fabrics. GSM and price/kg here drive the breaker weight and cost calculation.</p>
      </div>
      <button class="btn btn-accent btn-sm" id="btn-add-breaker">+ Add Breaker</button>
    </div>
    <table class="data-table">
      <thead><tr><th>Code</th><th>Name</th><th>Type</th><th class="num">GSM</th><th class="num">Thk (mm)</th><th class="num">Plies</th><th class="num">₹/kg</th><th>Mount</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${breakers.map(r => `
          <tr class="${r.active !== false ? '' : 'row-inactive'}">
            <td class="mono">${escHtml(r.code)}</td>
            <td>${escHtml(r.name ?? r.code)}</td>
            <td>${escHtml(r.breaker_type ?? '—')}</td>
            <td class="num">${r.gsm ?? '—'}</td>
            <td class="num">${r.thickness_mm ?? '—'}</td>
            <td class="num">${r.no_of_ply_default ?? '—'}</td>
            <td class="num">₹${(r.price_per_kg ?? 0).toFixed(2)}</td>
            <td>${escHtml(r.default_mount ?? '—')}</td>
            <td><span class="badge badge-${r.active !== false ? 'active' : 'archived'}">${r.active !== false ? 'Active' : 'Archived'}</span></td>
            <td class="table-actions">
              <button class="btn btn-sm btn-outline"       data-action="edit-breaker"    data-id="${escHtml(r.id)}">Edit</button>
              ${r.active !== false
                ? `<button class="btn btn-sm btn-danger-ghost" data-action="archive-breaker" data-id="${escHtml(r.id)}">Archive</button>`
                : `<button class="btn btn-sm btn-ghost"        data-action="restore-breaker" data-id="${escHtml(r.id)}">Restore</button>`}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function bindBreakerActions(area) {
  area.querySelector('#btn-add-breaker')?.addEventListener('click', () => openBreakerModal(null));
  area.querySelectorAll('[data-action]').forEach(btn => {
    const { action, id } = btn.dataset;
    if (action === 'edit-breaker')    btn.addEventListener('click', () => openBreakerModal(id));
    if (action === 'archive-breaker') btn.addEventListener('click', () => {
      if (confirm(`Archive breaker "${id}"?`)) {
        archiveMasterEntry('breaker', id);
        auditLog({ entity: 'master.breaker', entity_id: id, action: 'archived', diff: { active: false } });
        showToast(`Breaker ${id} archived.`); refreshTab();
      }
    });
    if (action === 'restore-breaker') btn.addEventListener('click', () => {
      restoreMasterEntry('breaker', id);
      auditLog({ entity: 'master.breaker', entity_id: id, action: 'restored', diff: { active: true } });
      showToast(`Breaker ${id} restored.`); refreshTab();
    });
  });
}

function openBreakerModal(id) {
  const breakers = getLiveBreakers();
  const entry    = id ? breakers.find(r => r.id === id) : null;
  const isNew    = !entry;
  const newId    = isNew ? generateMasterId('breaker') : entry.id;

  showModal(isNew ? 'Add Breaker' : `Edit Breaker — ${entry.code}`, `
    <div class="modal-form-grid">
      <div class="form-group">
        <label>Code *</label>
        <input type="text" name="code" value="${escHtml(entry?.code ?? '')}" placeholder="e.g. NN-100">
      </div>
      <div class="form-group">
        <label>Name</label>
        <input type="text" name="name" value="${escHtml(entry?.name ?? '')}">
      </div>
      <div class="form-group">
        <label>Breaker Type *</label>
        <select name="breaker_type">
          ${['Regular Fabric Breaker','Cross Rigid Fabric Breaker','Steel Breaker','Cord Breaker'].map(t =>
            `<option value="${t}" ${entry?.breaker_type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>GSM</label>
        <input type="number" name="gsm" step="1" min="0" value="${entry?.gsm ?? ''}">
      </div>
      <div class="form-group">
        <label>Thickness (mm)</label>
        <input type="number" name="thickness_mm" step="0.01" min="0" value="${entry?.thickness_mm ?? ''}">
      </div>
      <div class="form-group">
        <label>Default Ply Count</label>
        <input type="number" name="no_of_ply_default" step="1" min="1" value="${entry?.no_of_ply_default ?? 1}">
      </div>
      <div class="form-group">
        <label>Price (₹/kg) *</label>
        <input type="number" name="price_per_kg" step="0.01" min="0" value="${entry?.price_per_kg ?? ''}">
      </div>
      <div class="form-group">
        <label>Default Mount</label>
        <select name="default_mount">
          <option value="NON_FLOATING" ${(entry?.default_mount ?? 'NON_FLOATING') === 'NON_FLOATING' ? 'selected' : ''}>Non-Floating</option>
          <option value="FLOATING"     ${entry?.default_mount === 'FLOATING' ? 'selected' : ''}>Floating</option>
        </select>
      </div>
      <div class="form-group">
        <label>Supplier Material Code</label>
        <input type="text" name="supplier_material_code" value="${escHtml(entry?.supplier_material_code ?? '')}">
      </div>
    </div>
  `, () => {
    const code  = mf('code');
    const price = mfNum('price_per_kg');
    if (!code || price == null) { showToast('Code and Price are required.'); return; }
    const updated = {
      ...(entry ?? {}),
      id: newId, code, name: mf('name') || code,
      breaker_type: mf('breaker_type'),
      gsm: mfNum('gsm'), thickness_mm: mfNum('thickness_mm'),
      no_of_ply_default: mfNum('no_of_ply_default') ?? 1,
      price_per_kg: price,
      default_mount: mf('default_mount') || 'NON_FLOATING',
      supplier_material_code: mf('supplier_material_code') || null,
      active: entry?.active !== false,
    };
    saveMasterEntry('breaker', updated);
    auditLog({ entity: 'master.breaker', entity_id: updated.id, action: isNew ? 'created' : 'edited', diff: {} });
    showToast(isNew ? `Breaker ${code} added.` : `Breaker ${code} saved.`);
    closeModal(); refreshTab();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FREIGHT MASTER
// ═══════════════════════════════════════════════════════════════════════════════

function renderFreightTable() {
  const zones  = getLiveFreight();
  const active = zones.filter(r => r.active !== false);
  return `
  <div class="master-table-wrap">
    <div class="master-table-header">
      <div>
        <h3>Freight Master <span class="master-note">(${active.length} active)</span></h3>
        <p class="master-info">Per-destination freight rates. Cost type: KG = rate × belt weight; RM = rate × length; SQMTR = rate × W_eff × length.</p>
      </div>
      <button class="btn btn-accent btn-sm" id="btn-add-freight">+ Add Destination</button>
    </div>
    <table class="data-table">
      <thead><tr><th>Code</th><th>State / Destination</th><th>City</th><th class="num">Rate</th><th>Cost Type</th><th>Rate Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${zones.map(r => `
          <tr class="${r.active !== false ? '' : 'row-inactive'}">
            <td class="mono">${escHtml(r.code ?? r.id)}</td>
            <td>${escHtml(r.state_name)}</td>
            <td>${escHtml(r.city ?? '—')}</td>
            <td class="num">${(r.rate_per_kg ?? 0).toFixed(2)}</td>
            <td class="mono">${escHtml(r.cost_type ?? 'KG')}</td>
            <td><span class="badge badge-${r.rate_status === 'confirmed' ? 'active' : 'pending'}">${escHtml(r.rate_status ?? 'confirmed')}</span></td>
            <td class="table-actions">
              <button class="btn btn-sm btn-outline"       data-action="edit-freight"    data-id="${escHtml(r.id)}">Edit</button>
              ${r.active !== false
                ? `<button class="btn btn-sm btn-danger-ghost" data-action="archive-freight" data-id="${escHtml(r.id)}">Archive</button>`
                : `<button class="btn btn-sm btn-ghost"        data-action="restore-freight" data-id="${escHtml(r.id)}">Restore</button>`}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function bindFreightActions(area) {
  area.querySelector('#btn-add-freight')?.addEventListener('click', () => openFreightModal(null));
  area.querySelectorAll('[data-action]').forEach(btn => {
    const { action, id } = btn.dataset;
    if (action === 'edit-freight')    btn.addEventListener('click', () => openFreightModal(id));
    if (action === 'archive-freight') btn.addEventListener('click', () => {
      if (confirm(`Archive freight zone "${id}"?`)) {
        archiveMasterEntry('freight', id);
        showToast(`Freight ${id} archived.`); refreshTab();
      }
    });
    if (action === 'restore-freight') btn.addEventListener('click', () => {
      restoreMasterEntry('freight', id);
      showToast(`Freight ${id} restored.`); refreshTab();
    });
  });
}

function openFreightModal(id) {
  const zones = getLiveFreight();
  const entry = id ? zones.find(r => r.id === id) : null;
  const isNew = !entry;
  const newId = isNew ? generateMasterId('freight') : entry.id;

  showModal(isNew ? 'Add Freight Zone' : `Edit Freight — ${entry.state_name}`, `
    <div class="modal-form-grid">
      <div class="form-group">
        <label>Code *</label>
        <input type="text" name="code" value="${escHtml(entry?.code ?? '')}" placeholder="e.g. GJ">
      </div>
      <div class="form-group">
        <label>State / Destination *</label>
        <input type="text" name="state_name" value="${escHtml(entry?.state_name ?? '')}">
      </div>
      <div class="form-group">
        <label>City (optional)</label>
        <input type="text" name="city" value="${escHtml(entry?.city ?? '')}">
      </div>
      <div class="form-group">
        <label>Rate *</label>
        <input type="number" name="rate_per_kg" step="0.01" min="0" value="${entry?.rate_per_kg ?? ''}">
      </div>
      <div class="form-group">
        <label>Cost Type</label>
        <select name="cost_type">
          <option value="KG"    ${(entry?.cost_type ?? 'KG') === 'KG'    ? 'selected' : ''}>KG (per kg of belt weight)</option>
          <option value="RM"    ${entry?.cost_type === 'RM'    ? 'selected' : ''}>RM (per running metre)</option>
          <option value="SQMTR" ${entry?.cost_type === 'SQMTR' ? 'selected' : ''}>SQMTR (per m²)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Rate Status</label>
        <select name="rate_status">
          <option value="confirmed" ${(entry?.rate_status ?? 'confirmed') === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="pending"   ${entry?.rate_status === 'pending' ? 'selected' : ''}>Pending</option>
        </select>
      </div>
    </div>
  `, () => {
    const code  = mf('code');
    const state = mf('state_name');
    const rate  = mfNum('rate_per_kg');
    if (!code || !state || rate == null) { showToast('Code, State and Rate are required.'); return; }
    const updated = {
      ...(entry ?? {}),
      id: newId, code, state_name: state, city: mf('city') || null,
      rate_per_kg: rate, cost_type: mf('cost_type') || 'KG',
      rate_status: mf('rate_status') || 'confirmed',
      active: entry?.active !== false,
    };
    saveMasterEntry('freight', updated);
    showToast(isNew ? `Freight ${code} added.` : `Freight ${code} saved.`);
    closeModal(); refreshTab();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REEL / PACKING MASTER
// ═══════════════════════════════════════════════════════════════════════════════

function renderPackingTable() {
  const rows   = getLivePacking();
  const active = rows.filter(r => r.active !== false);
  return `
  <div class="master-table-wrap">
    <div class="master-table-header">
      <div>
        <h3>Reel &amp; Packing Master <span class="master-note">(${active.length} active)</span></h3>
        <p class="master-info">Two separate dropdowns on the form — filtered by applies_to (REEL / PACKING).</p>
      </div>
      <button class="btn btn-accent btn-sm" id="btn-add-packing">+ Add Type</button>
    </div>
    <table class="data-table">
      <thead><tr><th>Code</th><th>Name</th><th class="num">Cost/m (₹)</th><th>Applies To</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr class="${r.active !== false ? '' : 'row-inactive'}">
            <td class="mono">${escHtml(r.code)}</td>
            <td>${escHtml(r.name)}</td>
            <td class="num">₹${(r.packing_cost_per_meter ?? 0).toFixed(2)}</td>
            <td class="mono">${escHtml(r.applies_to ?? '—')}</td>
            <td><span class="badge badge-${r.active !== false ? 'active' : 'archived'}">${r.active !== false ? 'Active' : 'Archived'}</span></td>
            <td class="table-actions">
              <button class="btn btn-sm btn-outline"       data-action="edit-packing"    data-id="${escHtml(r.id)}">Edit</button>
              ${r.active !== false
                ? `<button class="btn btn-sm btn-danger-ghost" data-action="archive-packing" data-id="${escHtml(r.id)}">Archive</button>`
                : `<button class="btn btn-sm btn-ghost"        data-action="restore-packing" data-id="${escHtml(r.id)}">Restore</button>`}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function bindPackingActions(area) {
  area.querySelector('#btn-add-packing')?.addEventListener('click', () => openPackingModal(null));
  area.querySelectorAll('[data-action]').forEach(btn => {
    const { action, id } = btn.dataset;
    if (action === 'edit-packing')    btn.addEventListener('click', () => openPackingModal(id));
    if (action === 'archive-packing') btn.addEventListener('click', () => {
      if (confirm(`Archive packing type "${id}"?`)) { archiveMasterEntry('packing', id); showToast('Archived.'); refreshTab(); }
    });
    if (action === 'restore-packing') btn.addEventListener('click', () => { restoreMasterEntry('packing', id); showToast('Restored.'); refreshTab(); });
  });
}

function openPackingModal(id) {
  const rows  = getLivePacking();
  const entry = id ? rows.find(r => r.id === id) : null;
  const isNew = !entry;
  const newId = isNew ? generateMasterId('packing') : entry.id;

  showModal(isNew ? 'Add Packing / Reel Type' : `Edit — ${entry.name}`, `
    <div class="modal-form-grid">
      <div class="form-group">
        <label>Code *</label>
        <input type="text" name="code" value="${escHtml(entry?.code ?? '')}">
      </div>
      <div class="form-group">
        <label>Name *</label>
        <input type="text" name="name" value="${escHtml(entry?.name ?? '')}">
      </div>
      <div class="form-group">
        <label>Cost/m (₹) *</label>
        <input type="number" name="packing_cost_per_meter" step="0.01" min="0" value="${entry?.packing_cost_per_meter ?? ''}">
      </div>
      <div class="form-group">
        <label>Applies To</label>
        <select name="applies_to">
          <option value="packing" ${(entry?.applies_to ?? 'packing') === 'packing' ? 'selected' : ''}>Packing</option>
          <option value="reel"    ${entry?.applies_to === 'reel'    ? 'selected' : ''}>Reel</option>
          <option value="both"    ${entry?.applies_to === 'both'    ? 'selected' : ''}>Both</option>
        </select>
      </div>
    </div>
  `, () => {
    const code = mf('code'); const name = mf('name'); const cost = mfNum('packing_cost_per_meter');
    if (!code || !name || cost == null) { showToast('Code, Name and Cost are required.'); return; }
    saveMasterEntry('packing', { ...(entry ?? {}), id: newId, code, name, packing_cost_per_meter: cost, applies_to: mf('applies_to') || 'packing', active: entry?.active !== false });
    showToast(isNew ? `${name} added.` : `${name} saved.`); closeModal(); refreshTab();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GP BANDS  (read-only in v1)
// ═══════════════════════════════════════════════════════════════════════════════

function renderGpTable() {
  return `
  <div class="master-table-wrap">
    <h3>GP Bands <span class="master-note">(v1 read-only)</span></h3>
    <p>Minimum GP%: <strong>${(GP_MASTER.min_gp_pct * 100).toFixed(0)}%</strong></p>
    <table class="data-table">
      <thead><tr><th>ID</th><th>Label</th><th class="num">GP%</th></tr></thead>
      <tbody>
        ${GP_MASTER.bands.map(r => `
          <tr>
            <td class="mono">${r.id}</td>
            <td>${r.label}</td>
            <td class="num">${(r.gp_pct * 100).toFixed(0)}%</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE TYPE MASTER
// ═══════════════════════════════════════════════════════════════════════════════

function renderEdgeTable() {
  const edges  = getLiveEdges();
  const active = edges.filter(r => r.active !== false);
  return `
  <div class="master-table-wrap">
    <div class="master-table-header">
      <div>
        <h3>Belt Construction Type Master <span class="master-note">(${active.length} active)</span></h3>
        <p class="master-info">width_wastage_mm parametrises the legacy +30 mm bug (C8). Cut Edge = 30 mm, Moulded = 0 mm.</p>
      </div>
      <button class="btn btn-accent btn-sm" id="btn-add-edge">+ Add Belt Construction Type</button>
    </div>
    <table class="data-table">
      <thead><tr><th>ID</th><th>Belt Construction Type</th><th class="num">Width Wastage (mm)</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${edges.map(r => `
          <tr class="${r.active !== false ? '' : 'row-inactive'}">
            <td class="mono">${escHtml(r.id)}</td>
            <td>${escHtml(r.name ?? r.edge_type ?? r.id)}</td>
            <td class="num">${r.width_wastage_mm ?? '—'}</td>
            <td><span class="badge badge-${r.active !== false ? 'active' : 'archived'}">${r.active !== false ? 'Active' : 'Archived'}</span></td>
            <td class="table-actions">
              <button class="btn btn-sm btn-outline"       data-action="edit-edge"    data-id="${escHtml(r.id)}">Edit</button>
              ${r.active !== false
                ? `<button class="btn btn-sm btn-danger-ghost" data-action="archive-edge" data-id="${escHtml(r.id)}">Archive</button>`
                : `<button class="btn btn-sm btn-ghost"        data-action="restore-edge" data-id="${escHtml(r.id)}">Restore</button>`}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function bindEdgeActions(area) {
  area.querySelector('#btn-add-edge')?.addEventListener('click', () => openEdgeModal(null));
  area.querySelectorAll('[data-action]').forEach(btn => {
    const { action, id } = btn.dataset;
    if (action === 'edit-edge')    btn.addEventListener('click', () => openEdgeModal(id));
    if (action === 'archive-edge') btn.addEventListener('click', () => {
      if (confirm(`Archive edge type "${id}"?`)) { archiveMasterEntry('edge', id); showToast('Archived.'); refreshTab(); }
    });
    if (action === 'restore-edge') btn.addEventListener('click', () => { restoreMasterEntry('edge', id); showToast('Restored.'); refreshTab(); });
  });
}

function openEdgeModal(id) {
  const edges = getLiveEdges();
  const entry = id ? edges.find(r => r.id === id) : null;
  const isNew = !entry;
  const newId = isNew ? generateMasterId('edge') : entry.id;

  showModal(isNew ? 'Add Belt Construction Type' : `Edit — ${entry.name ?? entry.id}`, `
    <div class="modal-form-grid">
      <div class="form-group">
        <label>ID / Code *</label>
        <input type="text" name="code" value="${escHtml(entry?.id ?? '')}" ${!isNew ? 'readonly' : ''}  placeholder="e.g. CUT_EDGE">
      </div>
      <div class="form-group">
        <label>Name *</label>
        <input type="text" name="name" value="${escHtml(entry?.name ?? entry?.edge_type ?? '')}">
      </div>
      <div class="form-group">
        <label>Width Wastage (mm) *</label>
        <input type="number" name="width_wastage_mm" step="1" min="0" value="${entry?.width_wastage_mm ?? 0}">
        <small class="form-hint">Cut Edge = 30, Moulded = 0, Vulcanised = 0</small>
      </div>
    </div>
  `, () => {
    const code    = isNew ? mf('code') : entry.id;
    const name    = mf('name');
    const wastage = mfNum('width_wastage_mm');
    if (!code || !name || wastage == null) { showToast('All fields required.'); return; }
    saveMasterEntry('edge', { ...(entry ?? {}), id: code, name, edge_type: name, width_wastage_mm: wastage, active: entry?.active !== false });
    showToast(isNew ? `${name} added.` : `${name} saved.`); closeModal(); refreshTab();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIDTH REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════

function renderWidthRequests(area) {
  const requests = storageGetAll('width_request.');
  if (requests.length === 0) {
    area.innerHTML = '<div class="master-table-wrap"><h3>Width Requests</h3><p class="empty-state">No custom width requests.</p></div>';
    return;
  }
  area.innerHTML = `
    <div class="master-table-wrap">
      <h3>Width Requests</h3>
      <p class="master-info">Approve pending requests to allow quotations using these widths to be sent.</p>
      <table class="data-table">
        <thead><tr><th>ID</th><th>Width (mm)</th><th>Note</th><th>Status</th><th>Date</th><th></th></tr></thead>
        <tbody>
          ${requests.map(r => `
            <tr>
              <td class="mono">${r.id}</td>
              <td class="num">${r.width_mm}</td>
              <td>${escHtml(r.note ?? '')}</td>
              <td><span class="badge badge-${r.status}">${r.status}</span></td>
              <td>${r.created_at?.slice(0,10) ?? ''}</td>
              <td>${r.status === 'pending' ? `<button class="btn btn-sm btn-accent" data-approve="${r.id}">Approve</button>` : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  area.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', () => {
      const req = storageGet(`width_request.${btn.dataset.approve}`);
      if (req) {
        req.status = 'approved';
        storageSet(`width_request.${req.id}`, req);
        auditLog({ entity: 'width_request', entity_id: req.id, action: 'edited', diff: { status: 'approved' } });
        showToast(`Width request ${req.id} approved.`);
        renderWidthRequests(area);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CURRENCY MASTER
// ═══════════════════════════════════════════════════════════════════════════════

function renderCurrencyTable() {
  const all      = getAllCurrencies(true);
  const active   = all.filter(r => r.active !== false);
  const archived = all.filter(r => r.active === false);
  return `
  <div class="master-table-wrap">
    <div class="master-table-header">
      <div>
        <h3>Currency Master <span class="master-note">(${active.length} active, ${archived.length} archived)</span></h3>
        <p class="master-info">Exchange rates against INR. Used for foreign-currency quotations. Rates are entered manually and must be kept current.</p>
      </div>
      <button class="btn btn-accent btn-sm" id="btn-add-currency">+ Add Currency</button>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Code</th><th>Symbol</th><th>Name</th>
          <th class="num">Exchange Rate (1 unit → ₹)</th>
          <th>Status</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${all.map(r => `
          <tr class="${r.active !== false ? '' : 'row-inactive'}">
            <td class="mono">${escHtml(r.code ?? '—')}</td>
            <td style="font-size:1.1rem">${escHtml(r.symbol ?? '—')}</td>
            <td>${escHtml(r.name ?? '—')}</td>
            <td class="num mono">${r.exchange_rate != null ? Number(r.exchange_rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}</td>
            <td><span class="badge badge-${r.active !== false ? 'active' : 'archived'}">${r.active !== false ? 'Active' : 'Archived'}</span></td>
            <td class="table-actions">
              <button class="btn btn-sm btn-outline" data-action="edit-currency"   data-id="${escHtml(r.id)}">Edit</button>
              ${r.code === 'INR' ? '' : (r.active !== false
                ? `<button class="btn btn-sm btn-danger-ghost" data-action="archive-currency" data-id="${escHtml(r.id)}">Archive</button>`
                : `<button class="btn btn-sm btn-ghost"        data-action="restore-currency" data-id="${escHtml(r.id)}">Restore</button>`)}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function bindCurrencyActions(area) {
  area.querySelector('#btn-add-currency')?.addEventListener('click', () => openCurrencyModal(null));
  area.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    const id     = btn.dataset.id;
    if (action === 'edit-currency') btn.addEventListener('click', () => openCurrencyModal(id));
    if (action === 'archive-currency') btn.addEventListener('click', () => {
      const rec = getCurrency(id);
      if (confirm(`Archive ${rec?.name ?? id}? It will no longer appear in pickers.`)) {
        try { deactivateCurrency(id); showToast('Archived.'); refreshTab(); }
        catch (e) { showToast(e.message); }
      }
    });
    if (action === 'restore-currency') btn.addEventListener('click', () => {
      const rec = getCurrency(id);
      if (rec) { saveCurrency({ ...rec, active: true }); showToast('Restored.'); refreshTab(); }
    });
  });
}

function openCurrencyModal(id) {
  const entry = id ? getCurrency(id) : null;
  const isNew = !entry;

  showModal(isNew ? 'Add Currency' : `Edit — ${entry.name ?? entry.code}`, `
    <div class="modal-form-grid">
      <div class="form-group">
        <label>ISO Code *</label>
        <input type="text" name="currency_code" value="${escHtml(entry?.code ?? '')}"
          ${!isNew ? 'readonly' : ''} placeholder="e.g. USD" maxlength="10"
          style="text-transform:uppercase">
        <small class="form-hint">Standard 3-letter code (USD, EUR, GBP, AED…)</small>
      </div>
      <div class="form-group">
        <label>Symbol *</label>
        <input type="text" name="currency_symbol" value="${escHtml(entry?.symbol ?? '')}"
          placeholder="e.g. $" maxlength="5">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Currency Name *</label>
        <input type="text" name="currency_name" value="${escHtml(entry?.name ?? '')}"
          placeholder="e.g. US Dollar">
      </div>
      <div class="form-group" style="grid-column:1/-1">
        <label>Exchange Rate (₹ per 1 unit) *</label>
        <input type="number" name="currency_exchange_rate"
          value="${entry?.exchange_rate ?? ''}"
          step="0.0001" min="0.0001"
          placeholder="e.g. 84.50">
        <small class="form-hint">How many Indian Rupees equal 1 unit of this currency. INR = 1 (fixed).</small>
      </div>
    </div>
  `, () => {
    const code  = isNew ? mf('currency_code').toUpperCase() : entry.code;
    const sym   = mf('currency_symbol');
    const name  = mf('currency_name');
    const rate  = mfNum('currency_exchange_rate');

    if (!code)         { showToast('ISO code is required.'); return; }
    if (!sym)          { showToast('Symbol is required.'); return; }
    if (!name)         { showToast('Currency name is required.'); return; }
    if (rate == null || rate <= 0) { showToast('Enter a valid exchange rate greater than 0.'); return; }

    // For INR, rate must stay 1
    if (code === 'INR' && rate !== 1) { showToast('INR is the base currency — exchange rate must be 1.'); return; }

    saveCurrency({ ...(entry ?? {}), id: entry?.id ?? undefined, code, name, symbol: sym, exchange_rate: rate, active: entry?.active !== false });
    showToast(isNew ? `${name} added.` : `${name} saved.`);
    closeModal();
    refreshTab();
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showToast(msg) {
  window.dispatchEvent(new CustomEvent('ravasco:toast', { detail: { msg } }));
}
