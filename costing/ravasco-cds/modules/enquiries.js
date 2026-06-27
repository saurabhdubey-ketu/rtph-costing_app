// modules/enquiries.js
import { storageGet, storageSet, storageGetAll } from '../lib/storage.js';
import { nextEnquiryId } from '../lib/id.js';
import { auditLog } from '../lib/audit.js';
import { formatDate } from '../lib/formatter.js';
import { mountCombobox } from '../lib/dropdown.js';
import { getAllCustomers, getCustomer, resolveCustomerSite, parseOptionKey } from '../masters/customer_master.js';

export function renderEnquiries(container, params = {}) {
  container.innerHTML = `
    <div class="page-header">
      <h2>Enquiries</h2>
    </div>
    <div id="enquiry-form-area"></div>
    <div id="enquiry-table-area"></div>
  `;
  showEnquiryForm(null, params.customer_id ?? null, params.then_quote ?? false);
  renderEnquiryTable();
}

// ── table helpers ─────────────────────────────────────────────────────────────

function enquiryCustomerLabel(enq, customers) {
  const cust = customers[enq.customer_id];
  let label = cust?.name ?? enq.customer_id;
  const city  = enq.city  ?? (enq.location_id ? resolveCustomerSite(enq.customer_id, enq.location_id)?.city  : cust?.city);
  const state = enq.state ?? (enq.location_id ? resolveCustomerSite(enq.customer_id, enq.location_id)?.state : cust?.state);
  const parts = [city, state].filter(Boolean);
  if (parts.length) label += ' — ' + parts.join(', ');
  return label;
}

function renderEnquiryTable() {
  const area = document.getElementById('enquiry-table-area');
  if (!area) return;
  const enquiries = storageGetAll('enquiry.').sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const customers = Object.fromEntries(getAllCustomers(true).map(c => [c.id, c]));

  if (enquiries.length === 0) {
    area.innerHTML = '<p class="empty-state">No enquiries yet. Fill in the form above to create one.</p>';
    return;
  }
  area.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Enquiry ID</th><th>Customer</th><th>Description</th><th>Date</th><th>Status</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${enquiries.map(enq => `
          <tr>
            <td class="mono">${enq.id}</td>
            <td>${escHtml(enquiryCustomerLabel(enq, customers))}</td>
            <td>${escHtml(enq.subject ?? '—')}</td>
            <td>${formatDate(enq.created_at)}</td>
            <td><span class="badge badge-${enq.status}">${enq.status}</span></td>
            <td>
              <button class="btn btn-sm" data-edit="${enq.id}">Edit</button>
              <button class="btn btn-sm btn-accent" data-quote="${enq.id}">New Quotation</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  area.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => showEnquiryForm(btn.dataset.edit))
  );
  area.querySelectorAll('[data-quote]').forEach(btn =>
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('ravasco:navigate', {
        detail: { view: 'quotations', action: 'new', enquiry_id: btn.dataset.quote },
      }));
    })
  );
}

// ── form ──────────────────────────────────────────────────────────────────────

function buildLocationItems() {
  const items = [];
  for (const c of getAllCustomers()) {
    const searchText = `${c.name ?? ''} ${c.id}`;   // name + ID both searchable
    if (c.locations?.length > 0) {
      for (const loc of c.locations) {
        const parts = [loc.city, loc.state].filter(Boolean);
        const locSuffix = parts.length ? ` (${parts.join(', ')})` : '';
        items.push({
          value:      `${c.id}|${loc.id}`,
          label:      `(${loc.id}) ${c.name ?? ''}${locSuffix}`,   // sub-ID avoids duplicate parent IDs
          searchText: `${c.name ?? ''} ${c.id} ${loc.id}`,          // parent + sub both searchable
        });
      }
    } else {
      items.push({ value: c.id, label: `(${c.id}) ${c.name ?? ''}`, searchText });
    }
  }
  return items.sort((a, b) => (a.label ?? '').localeCompare(b.label ?? '', 'en', { sensitivity: 'base' }));
}

function showEnquiryForm(id, presetCustomerId = null, thenQuote = false) {
  const area = document.getElementById('enquiry-form-area');
  const existing   = id ? storageGet(`enquiry.${id}`) : null;
  const isNew      = !existing;

  // Reconstruct the option_key that was stored when the enquiry was saved
  const initOptionKey = existing
    ? (existing.location_id ? `${existing.customer_id}|${existing.location_id}` : existing.customer_id)
    : (presetCustomerId ?? null);

  area.innerHTML = `
    <div class="card form-card">
      <h3>${isNew ? 'New Enquiry' : 'Edit Enquiry'}</h3>
      <form id="enquiry-form" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label>Customer / Destination *</label>
            <div id="customer-combo"></div>
            <span class="field-error" id="err-customer"></span>
          </div>
          <div class="form-group">
            <label>Description *</label>
            <input type="text" name="subject" id="inp-subject" value="${escHtml(existing?.subject ?? '')}">
            <span class="field-error" id="err-subject"></span>
          </div>
        </div>
        <div class="form-row" id="row-contact" style="display:none">
          <div class="form-group">
            <label>Email</label>
            <input type="text" name="email" id="inp-email">
          </div>
          <div class="form-group">
            <label>Mobile</label>
            <input type="text" name="mobile" id="inp-mobile">
          </div>
        </div>
        <div class="form-row" id="row-location" style="display:none">
          <div class="form-group">
            <label>State</label>
            <input type="text" name="state" id="inp-state">
          </div>
          <div class="form-group">
            <label>City</label>
            <input type="text" name="city" id="inp-city">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Status</label>
            <select name="status">
              <option value="open"   ${!existing || existing.status === 'open'   ? 'selected' : ''}>Open</option>
              <option value="quoted" ${existing?.status === 'quoted' ? 'selected' : ''}>Quoted</option>
              <option value="won"    ${existing?.status === 'won'    ? 'selected' : ''}>Won</option>
              <option value="lost"   ${existing?.status === 'lost'   ? 'selected' : ''}>Lost</option>
            </select>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <input type="text" name="notes" value="${escHtml(existing?.notes ?? '')}">
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            ${isNew ? (thenQuote ? 'Create Enquiry &amp; Proceed to Quote' : 'Create Enquiry') : 'Save'}
          </button>
          <button type="button" class="btn btn-ghost" id="btn-cancel-enq">Cancel</button>
        </div>
      </form>
    </div>
  `;

  mountCombobox({
    container:   area.querySelector('#customer-combo'),
    name:        'customer_id',
    items:       buildLocationItems(),
    selected:    initOptionKey,
    placeholder: 'Search by name or customer ID…',
  });

  // When a customer/location is picked, auto-populate the detail rows
  area.querySelector('input.combobox-value').addEventListener('change', e => {
    const { customer_id, location_id } = parseOptionKey(e.target.value);
    if (customer_id) {
      fillDetails(customer_id, location_id, null, null, null, null);
    } else {
      document.getElementById('row-contact').style.display  = 'none';
      document.getElementById('row-location').style.display = 'none';
    }
  });

  // Pre-fill for edit / preset
  if (initOptionKey) {
    const { customer_id, location_id } = parseOptionKey(initOptionKey);
    fillDetails(
      customer_id,
      location_id,
      existing?.email  ?? null,
      existing?.mobile ?? null,
      existing?.state  ?? null,
      existing?.city   ?? null,
    );
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  function fillDetails(customerId, locationId, savedEmail, savedMobile, savedState, savedCity) {
    const cust = getCustomer(customerId);
    if (!cust) return;

    document.getElementById('row-contact').style.display  = '';
    document.getElementById('row-location').style.display = '';

    document.getElementById('inp-email').value  = savedEmail  ?? cust.email ?? '';
    document.getElementById('inp-mobile').value = savedMobile ?? cust.phone ?? '';

    let city = '', state = '';
    if (locationId && cust.locations?.length > 0) {
      const loc = cust.locations.find(l => l.id === locationId);
      city  = loc?.city  ?? '';
      state = loc?.state ?? '';
    } else {
      city  = cust.city  ?? '';
      state = cust.state ?? '';
    }
    document.getElementById('inp-state').value = savedState ?? state;
    document.getElementById('inp-city').value  = savedCity  ?? city;
  }

  // ── cancel ────────────────────────────────────────────────────────────────
  document.getElementById('btn-cancel-enq').addEventListener('click', () => showEnquiryForm(null));

  // ── submit ────────────────────────────────────────────────────────────────
  document.getElementById('enquiry-form').addEventListener('submit', e => {
    e.preventDefault();

    const optionKey  = (area.querySelector('input.combobox-value')?.value ?? '').trim();
    const { customer_id, location_id } = parseOptionKey(optionKey);
    const subject = document.getElementById('inp-subject').value.trim();
    let valid = true;

    document.getElementById('err-customer').textContent = '';
    document.getElementById('err-subject').textContent  = '';

    if (!customer_id) {
      document.getElementById('err-customer').textContent = 'Customer is required.';
      valid = false;
    }
    if (!subject) {
      document.getElementById('err-subject').textContent = 'Description is required.';
      valid = false;
    }
    if (!valid) return;

    const fd    = new FormData(e.target);
    const enqId = isNew ? nextEnquiryId() : existing.id;

    const record = {
      id:          enqId,
      customer_id,
      location_id: location_id ?? null,
      subject,
      email:  fd.get('email')?.trim()  || null,
      mobile: fd.get('mobile')?.trim() || null,
      state:  fd.get('state')?.trim()  || null,
      city:   fd.get('city')?.trim()   || null,
      status: fd.get('status'),
      notes:  fd.get('notes')?.trim()  || null,
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    storageSet(`enquiry.${enqId}`, record);
    auditLog({ entity: 'enquiry', entity_id: enqId, action: isNew ? 'created' : 'edited', diff: record });
    showToast(isNew ? `Enquiry ${enqId} created.` : 'Enquiry saved.');

    if (isNew && thenQuote) {
      window.dispatchEvent(new CustomEvent('ravasco:navigate', {
        detail: { view: 'quotations', action: 'new', enquiry_id: enqId },
      }));
      return;
    }

    showEnquiryForm(null);
    renderEnquiryTable();
  });
}

// ── utilities ─────────────────────────────────────────────────────────────────

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg) {
  window.dispatchEvent(new CustomEvent('ravasco:toast', { detail: { msg } }));
}
