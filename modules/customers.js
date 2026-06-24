// modules/customers.js
// Customer list and create/edit form.

import { formatDate } from '../lib/formatter.js';
import { saveCustomer, getCustomer, getAllCustomers, disableCustomer, enableCustomer } from '../masters/customer_master.js';

const INDIA_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// Build { state → { city → Set<pin> } } from all customer records.
function buildStateCityMap() {
  const map = {};
  getAllCustomers().forEach(c => {
    const entries = c.locations?.length ? c.locations : (c.state ? [c] : []);
    entries.forEach(e => {
      if (!e.state) return;
      if (!map[e.state]) map[e.state] = {};
      if (e.city) {
        if (!map[e.state][e.city]) map[e.state][e.city] = new Set();
        if (e.postal_code) map[e.state][e.city].add(e.postal_code);
      }
    });
  });
  return map;
}

function getCitiesForState(map, state) {
  return Object.keys(map[state] || {}).sort();
}

function getPinsForCity(map, state, city) {
  return [...(map[state]?.[city] ?? new Set())].sort();
}

// Counter increments only upward — indices stay unique even after card removal.
let _locCardIdx = 0;

function locationCardHtml(idx, loc, map) {
  const stateOpts = INDIA_STATES
    .map(s => `<option value="${escHtml(s)}"${s === loc.state ? ' selected' : ''}>${escHtml(s)}</option>`)
    .join('');

  // Include existing city even if not in master data (handles legacy records).
  const masterCities = loc.state ? getCitiesForState(map, loc.state) : [];
  const extraCity    = loc.city && !masterCities.includes(loc.city) ? [loc.city] : [];
  const cities       = [...new Set([...masterCities, ...extraCity])].sort();
  const cityOpts     = cities
    .map(ct => `<option value="${escHtml(ct)}"${ct === loc.city ? ' selected' : ''}>${escHtml(ct)}</option>`)
    .join('');

  return `
    <div class="location-card" data-loc-idx="${idx}">
      <input type="hidden" name="loc_id_${idx}" value="${escHtml(loc.id ?? '')}">
      <div class="form-row">
        <div class="form-group">
          <label>State</label>
          <select name="loc_state_${idx}" data-loc-state="${idx}">
            <option value="">Select State…</option>
            ${stateOpts}
          </select>
        </div>
        <div class="form-group">
          <label>City</label>
          <select name="loc_city_${idx}" data-loc-city="${idx}"${!loc.state ? ' disabled' : ''}>
            <option value="">Select City…</option>
            ${cityOpts}
          </select>
        </div>
        <div class="form-group">
          <label>PIN Code</label>
          <input type="text" name="loc_pin_${idx}" data-loc-pin="${idx}"
            maxlength="6" pattern="[0-9]{6}" placeholder="6-digit PIN"
            value="${escHtml(loc.postal_code ?? '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>GST Number</label>
          <input type="text" name="loc_gst_${idx}" value="${escHtml(loc.gst ?? '')}">
        </div>
        <div class="form-group">
          <label>Address</label>
          <input type="text" name="loc_address_${idx}" value="${escHtml(loc.address ?? '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="loc_email_${idx}" value="${escHtml(loc.email ?? '')}">
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input type="text" name="loc_phone_${idx}" value="${escHtml(loc.phone ?? '')}">
        </div>
      </div>
      <div class="loc-remove-row">
        <button type="button" class="btn btn-sm btn-danger-ghost btn-remove-loc"
          data-remove-loc="${idx}" style="display:none">− Remove this location</button>
      </div>
    </div>`;
}

function wireLocationCard(card, map) {
  const idx     = card.dataset.locIdx;
  const stateEl = card.querySelector(`[data-loc-state="${idx}"]`);
  const cityEl  = card.querySelector(`[data-loc-city="${idx}"]`);
  const pinEl   = card.querySelector(`[data-loc-pin="${idx}"]`);

  stateEl.addEventListener('change', () => {
    const state  = stateEl.value;
    const cities = state ? getCitiesForState(map, state) : [];
    cityEl.innerHTML = '<option value="">Select City…</option>' +
      cities.map(ct => `<option value="${escHtml(ct)}">${escHtml(ct)}</option>`).join('');
    cityEl.disabled  = !state;
    cityEl.value     = '';
    pinEl.value      = '';
  });

  cityEl.addEventListener('change', () => {
    const pins = getPinsForCity(map, stateEl.value, cityEl.value);
    if (pins.length === 1) pinEl.value = pins[0];
  });
}

function syncRemoveButtons() {
  const cards = document.querySelectorAll('#location-cards .location-card');
  cards.forEach(card => {
    const btn = card.querySelector('.btn-remove-loc');
    if (btn) btn.style.display = cards.length > 1 ? '' : 'none';
  });
}

export function renderCustomers(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Customers</h2>
      <button class="btn btn-primary" id="btn-new-customer">+ New Customer</button>
    </div>
    <div id="customer-form-area"></div>
    <div id="customer-table-area"></div>
  `;
  renderCustomerTable();
  document.getElementById('btn-new-customer').addEventListener('click', () => showCustomerForm(null));
}

function renderCustomerTable() {
  const area      = document.getElementById('customer-table-area');
  const customers = getAllCustomers(true); // include disabled so they can be re-enabled
  if (customers.length === 0) {
    area.innerHTML = '<p class="empty-state">No customers yet. Click "+ New Customer" to add one.</p>';
    return;
  }

  const rows = [];
  customers.forEach(c => {
    const locs      = c.locations?.length ?? 0;
    const dispCity  = locs ? (c.locations[0].city  || '—') : (c.city  || '—');
    const dispState = locs ? (c.locations[0].state || '—') : (c.state || '—');
    const dispPin   = locs ? (c.locations[0].postal_code || '—') : (c.postal_code || '—');

    // Multi-site toggle button; single-site has no toggle.
    const locToggle = locs > 1
      ? ` <button type="button" class="btn-loc-toggle" data-toggle="${c.id}" aria-expanded="false">${locs} locations ▼</button>`
      : '';

    const isActive  = c.active !== false;
    const rowStyle  = isActive ? '' : 'opacity:.45';
    const statusToggle = `
      <button class="status-toggle" data-toggle-status="${escHtml(c.id)}" data-active="${isActive}"
        title="${isActive ? 'Click to disable' : 'Click to enable'}"
        style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;border:none;background:none;padding:0">
        <span style="
          display:inline-block;width:36px;height:20px;border-radius:10px;
          background:${isActive ? '#16a34a' : '#ef4444'};
          position:relative;transition:background .2s">
          <span style="
            display:block;width:14px;height:14px;border-radius:50%;background:#fff;
            position:absolute;top:3px;
            ${isActive ? 'right:3px' : 'left:3px'};
            transition:left .2s,right .2s"></span>
        </span>
        <span style="font-weight:600;font-size:13px;color:${isActive ? '#16a34a' : '#ef4444'}">${isActive ? 'Active' : 'Disabled'}</span>
      </button>`;

    rows.push(`
      <tr class="customer-row" data-cid="${escHtml(c.id)}" style="${rowStyle}">
        <td class="mono">${escHtml(c.id)}</td>
        <td>${escHtml(c.name)}${locToggle}</td>
        <td>${c.email ? `<a href="mailto:${escHtml(c.email)}" style="color:var(--accent,#6c8ebf)">${escHtml(c.email)}</a>` : '—'}</td>
        <td class="mono">${escHtml(c.gst ?? '—')}</td>
        <td>${escHtml(dispCity)}</td>
        <td>${escHtml(dispState)}</td>
        <td class="mono">${escHtml(dispPin)}</td>
        <td>${statusToggle}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm" data-edit="${escHtml(c.id)}">Edit</button>
          ${isActive ? `<button class="btn btn-sm btn-primary" data-new-enquiry="${escHtml(c.id)}">+ Enquiry</button>` : ''}
          ${isActive ? `<button class="btn btn-sm btn-primary" data-new-quote="${escHtml(c.id)}">+ Quote</button>` : ''}
        </td>
        <td>${formatDate(c.created_at)}</td>
      </tr>`);

    // Hidden sub-rows — one per location, only for multi-site.
    if (locs > 1) {
      c.locations.slice(1).forEach(loc => {
        const place = [loc.city, loc.state, loc.postal_code].filter(Boolean).join(', ');
        const gstBit = loc.gst ? `<span class="loc-sub-gst">GST: ${escHtml(loc.gst)}</span>` : '';
        rows.push(`
          <tr class="location-sub-row" data-sub-parent="${escHtml(c.id)}" style="display:none">
            <td class="mono" style="padding-left:24px;font-size:12px;color:var(--color-text-muted,#8892a4)">
              <span style="margin-right:4px">└─</span>${escHtml(loc.id ?? '')}
            </td>
            <td style="font-size:12px;color:var(--color-text-muted,#8892a4)">${escHtml(loc.address ?? '—')}</td>
            <td>${loc.email ? `<a href="mailto:${escHtml(loc.email)}" style="color:var(--accent,#6c8ebf);font-size:12px">${escHtml(loc.email)}</a>` : '—'}</td>
            <td class="mono" style="font-size:12px">${escHtml(loc.gst ?? '—')}</td>
            <td style="font-size:12px">${escHtml(loc.city ?? '—')}</td>
            <td style="font-size:12px">${escHtml(loc.state ?? '—')}</td>
            <td class="mono" style="font-size:12px">${escHtml(loc.postal_code ?? '—')}</td>
            <td>${statusToggle}</td>
            <td style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-sm" data-edit="${escHtml(c.id)}" data-focus-loc="${escHtml(loc.id ?? '')}">Edit</button>
              ${isActive ? `<button class="btn btn-sm btn-primary" data-new-enquiry="${escHtml(c.id)}">+ Enquiry</button>` : ''}
              ${isActive ? `<button class="btn btn-sm btn-primary" data-new-quote="${escHtml(c.id)}">+ Quote</button>` : ''}
            </td>
            <td></td>
          </tr>`);
      });
    }
  });

  area.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>
            <div style="display:flex;flex-direction:column;gap:4px">
              <span>ID</span>
              <input id="customer-search-id" type="search" placeholder="Search ID…"
                style="font-weight:400;font-size:12px;padding:4px 8px;border-radius:4px;border:1px solid var(--border,#2e3350);background:#fff;color:#111;width:100%;box-sizing:border-box;min-width:100px">
            </div>
          </th>
          <th>
            <div style="display:flex;flex-direction:column;gap:4px">
              <span>Name</span>
              <input id="customer-search-name" type="search" placeholder="Search by name…"
                style="font-weight:400;font-size:12px;padding:4px 8px;border-radius:4px;border:1px solid var(--border,#2e3350);background:#fff;color:#111;width:100%;box-sizing:border-box;min-width:160px">
            </div>
          </th>
          <th>
            <div style="display:flex;flex-direction:column;gap:4px">
              <span>Email</span>
              <input id="customer-search-email" type="search" placeholder="Search email…"
                style="font-weight:400;font-size:12px;padding:4px 8px;border-radius:4px;border:1px solid var(--border,#2e3350);background:#fff;color:#111;width:100%;box-sizing:border-box;min-width:140px">
            </div>
          </th>
          <th>
            <div style="display:flex;flex-direction:column;gap:4px">
              <span>GST No.</span>
              <input id="customer-search-gst" type="search" placeholder="Search GST…"
                style="font-weight:400;font-size:12px;padding:4px 8px;border-radius:4px;border:1px solid var(--border,#2e3350);background:#fff;color:#111;width:100%;box-sizing:border-box;min-width:130px">
            </div>
          </th>
          <th>City</th><th>State</th>
          <th>
            <div style="display:flex;flex-direction:column;gap:4px">
              <span>PIN Code</span>
              <input id="customer-search-pin" type="search" placeholder="Search PIN…"
                style="font-weight:400;font-size:12px;padding:4px 8px;border-radius:4px;border:1px solid var(--border,#2e3350);background:#fff;color:#111;width:100%;box-sizing:border-box;min-width:90px">
            </div>
          </th>
          <th>Status</th><th></th><th>Created</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;

  // Edit buttons (parent row + sub-row)
  area.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => showCustomerForm(btn.dataset.edit, btn.dataset.focusLoc || null));
  });

  // New enquiry from customer
  area.querySelectorAll('[data-new-enquiry]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('ravasco:navigate', {
        detail: { view: 'enquiries', action: 'new', customer_id: btn.dataset.newEnquiry },
      }));
    });
  });

  // New quote from customer — show modal requiring enquiry first
  area.querySelectorAll('[data-new-quote]').forEach(btn => {
    btn.addEventListener('click', () => {
      const customerId = btn.dataset.newQuote;
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999';
      overlay.innerHTML = `
        <div style="background:var(--color-surface,#1e2235);border:1px solid var(--border,#2e3350);border-radius:10px;padding:32px 28px;max-width:420px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.4)">
          <div style="font-size:2rem;margin-bottom:12px">📋</div>
          <h3 style="margin:0 0 10px">Enquiry Required</h3>
          <p style="color:var(--color-text-muted,#8892a4);margin:0 0 24px;line-height:1.6">
            A quotation must be linked to an enquiry.<br>
            Please raise an enquiry for this customer first.
          </p>
          <div style="display:flex;gap:10px;justify-content:center">
            <button id="modal-go-enquiry" class="btn btn-primary">Enter Enquiry</button>
            <button id="modal-cancel" class="btn btn-ghost">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      overlay.querySelector('#modal-go-enquiry').addEventListener('click', () => {
        overlay.remove();
        window.dispatchEvent(new CustomEvent('ravasco:navigate', {
          detail: { view: 'enquiries', action: 'new', customer_id: customerId, then_quote: true },
        }));
      });
      overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    });
  });

  // Status toggle
  area.querySelectorAll('[data-toggle-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggleStatus;
      const isActive = btn.dataset.active === 'true';
      if (isActive) {
        if (!confirm(`Disable customer ${id}? They will no longer appear in quotation pickers.`)) return;
        disableCustomer(id);
      } else {
        enableCustomer(id);
      }
      renderCustomerTable();
    });
  });

  // Expand / collapse location sub-rows
  area.querySelectorAll('[data-toggle]').forEach(toggleBtn => {
    toggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      const cid      = toggleBtn.dataset.toggle;
      const subRows  = area.querySelectorAll(`[data-sub-parent="${cid}"]`);
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      const count    = subRows.length;
      toggleBtn.setAttribute('aria-expanded', String(!expanded));
      toggleBtn.textContent = `${count} locations ${expanded ? '▼' : '▲'}`;
      subRows.forEach(r => { r.style.display = expanded ? 'none' : ''; });
    });
  });

  // ID + Name search — both filters applied together (AND)
  function applyCustomerFilter() {
    const qId    = area.querySelector('#customer-search-id').value.trim().toLowerCase();
    const qName  = area.querySelector('#customer-search-name').value.trim().toLowerCase();
    const qEmail = area.querySelector('#customer-search-email').value.trim().toLowerCase();
    const qGst   = area.querySelector('#customer-search-gst').value.trim().toLowerCase();
    const qPin   = area.querySelector('#customer-search-pin').value.trim().toLowerCase();
    area.querySelectorAll('tbody tr.customer-row').forEach(row => {
      const cid   = row.dataset.cid;
      const id    = (row.querySelector('td:nth-child(1)')?.textContent ?? '').toLowerCase();
      const name  = (row.querySelector('td:nth-child(2)')?.textContent ?? '').toLowerCase();
      const email = (row.querySelector('td:nth-child(3)')?.textContent ?? '').toLowerCase();
      const gst   = (row.querySelector('td:nth-child(4)')?.textContent ?? '').toLowerCase();
      const pin   = (row.querySelector('td:nth-child(7)')?.textContent ?? '').toLowerCase();
      const visible = (!qId    || id.includes(qId))
                   && (!qName  || name.includes(qName))
                   && (!qEmail || email.includes(qEmail))
                   && (!qGst   || gst.includes(qGst))
                   && (!qPin   || pin.includes(qPin));
      row.style.display = visible ? '' : 'none';
      area.querySelectorAll(`[data-sub-parent="${cid}"]`).forEach(sub => {
        sub.style.display = visible ? (sub.style.display === '' ? '' : 'none') : 'none';
      });
    });
  }
  area.querySelector('#customer-search-id').addEventListener('input', applyCustomerFilter);
  area.querySelector('#customer-search-name').addEventListener('input', applyCustomerFilter);
  area.querySelector('#customer-search-email').addEventListener('input', applyCustomerFilter);
  area.querySelector('#customer-search-gst').addEventListener('input', applyCustomerFilter);
  area.querySelector('#customer-search-pin').addEventListener('input', applyCustomerFilter);
}

function showCustomerForm(id, focusLocId) {
  const area     = document.getElementById('customer-form-area');
  const existing = id ? getCustomer(id) : null;
  const isNew    = !existing;
  const map      = buildStateCityMap();

  // Normalise to a flat locations array regardless of single/multi-site model.
  let initLocs;
  if (existing?.locations?.length) {
    initLocs = existing.locations;
  } else if (existing) {
    initLocs = [{ id: '', gst: existing.gst, city: existing.city,
      state: existing.state, address: existing.address, postal_code: existing.postal_code }];
  } else {
    initLocs = [{ id: '', gst: null, city: null, state: null, address: null, postal_code: null }];
  }

  _locCardIdx = initLocs.length;

  area.innerHTML = `
    <div class="card form-card">
      <h3>${isNew ? 'New Customer' : 'Edit Customer'}</h3>
      <form id="customer-form" novalidate>

        <h4 style="margin:.75rem 0 .5rem">Company Details</h4>
        <div class="form-row">
          <div class="form-group form-group-full">
            <label>Customer Name *</label>
            <input type="text" name="name" value="${escHtml(existing?.name ?? '')}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Mobile / Phone</label>
            <input type="text" name="phone" value="${escHtml(existing?.phone ?? '')}">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="email" value="${escHtml(existing?.email ?? '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Contact Person</label>
            <input type="text" name="contact" value="${escHtml(existing?.contact ?? '')}">
          </div>
        </div>

        <hr class="loc-section-divider">
        <div class="loc-section-header">
          <h4>Locations / Sites</h4>
          <button type="button" class="btn btn-sm btn-ghost" id="btn-add-location">+ Add Location</button>
        </div>
        <div id="location-cards">
          ${initLocs.map((loc, i) => locationCardHtml(i, loc, map)).join('')}
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${isNew ? 'Create Customer' : 'Save Changes'}</button>
          <button type="button" class="btn btn-ghost" id="btn-cancel-customer">Cancel</button>
        </div>
      </form>
    </div>
  `;

  area.querySelectorAll('.location-card').forEach(card => wireLocationCard(card, map));
  syncRemoveButtons();

  // Highlight the specific location card if opened from a sub-row Edit button.
  if (focusLocId) {
    for (const card of area.querySelectorAll('.location-card')) {
      if ((card.querySelector('[name^="loc_id_"]')?.value ?? '') === focusLocId) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('location-card--focused');
        setTimeout(() => card.classList.remove('location-card--focused'), 2500);
        break;
      }
    }
  }

  document.getElementById('btn-add-location').addEventListener('click', () => {
    const cardsEl = document.getElementById('location-cards');
    const idx     = _locCardIdx++;
    const div     = document.createElement('div');
    div.innerHTML = locationCardHtml(idx, { id: '', gst: null, email: null, phone: null, city: null, state: null, address: null, postal_code: null }, map);
    const newCard = div.firstElementChild;
    cardsEl.appendChild(newCard);
    wireLocationCard(newCard, map);
    syncRemoveButtons();
    newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  document.getElementById('location-cards').addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-loc]');
    if (!btn) return;
    document.querySelector(`[data-loc-idx="${btn.dataset.removeLoc}"]`)?.remove();
    syncRemoveButtons();
  });

  document.getElementById('btn-cancel-customer').addEventListener('click', () => { area.innerHTML = ''; });

  document.getElementById('customer-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd   = new FormData(e.target);
    const name = fd.get('name').trim();
    if (!name) { showFieldError(e.target.querySelector('[name="name"]'), 'Name is required.'); return; }

    const locs = Array.from(document.querySelectorAll('#location-cards .location-card'))
      .map(card => {
        const i = card.dataset.locIdx;
        return {
          id:          (card.querySelector(`[name="loc_id_${i}"]`)?.value      ?? '').trim(),
          state:       (card.querySelector(`[name="loc_state_${i}"]`)?.value  ?? '').trim() || null,
          city:        (card.querySelector(`[name="loc_city_${i}"]`)?.value   ?? '').trim() || null,
          postal_code: (card.querySelector(`[name="loc_pin_${i}"]`)?.value    ?? '').trim() || null,
          gst:         (card.querySelector(`[name="loc_gst_${i}"]`)?.value    ?? '').trim() || null,
          address:     (card.querySelector(`[name="loc_address_${i}"]`)?.value ?? '').trim() || null,
          email:       (card.querySelector(`[name="loc_email_${i}"]`)?.value  ?? '').trim() || null,
          phone:       (card.querySelector(`[name="loc_phone_${i}"]`)?.value  ?? '').trim() || null,
        };
      })
      .filter(l => l.state || l.city || l.gst || l.postal_code || l.address);

    const common = {
      id:                 isNew ? undefined : existing.id,
      name,
      phone:              fd.get('phone')?.trim()   || null,
      email:              fd.get('email')?.trim()   || null,
      contact:            fd.get('contact')?.trim() || null,
    };

    // Single-site: 1 location with no pre-existing location id.
    // Multi-site:  2+ locations, OR 1 location that already has a CUS-XXXX-YY id.
    const isSingleSite = locs.length <= 1 && !locs[0]?.id;
    let payload;
    if (isSingleSite) {
      const loc = locs[0] ?? {};
      payload = { ...common, gst: loc.gst || null, city: loc.city || null,
        state: loc.state || null, address: loc.address || null,
        postal_code: loc.postal_code || null, locations: [] };
    } else {
      payload = { ...common, gst: null, city: null, state: null,
        address: null, postal_code: null, locations: locs };
    }

    const record = saveCustomer(payload);
    showToast(isNew ? `Customer ${record.id} created.` : 'Customer saved.');
    area.innerHTML = '';
    renderCustomerTable();
  });
}

function showFieldError(el, msg) {
  el.classList.add('input-error');
  if (!el.parentElement.querySelector('.field-error')) {
    const span = document.createElement('span');
    span.className = 'field-error';
    span.textContent = msg;
    el.parentElement.appendChild(span);
  }
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg) {
  window.dispatchEvent(new CustomEvent('ravasco:toast', { detail: { msg } }));
}
