// modules/quotations.js
// Quotation list view. New/revise quotation routing.

import { storageGetAll } from '../lib/storage.js';
import { getAllCustomers } from '../masters/customer_master.js';
import { formatDate, formatRupees } from '../lib/formatter.js';

export function renderQuotations(container, params = {}) {
  if (params.action === 'new' || params.action === 'edit') {
    // Delegate to quotation_form
    window.dispatchEvent(new CustomEvent('ravasco:load-form', { detail: params }));
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <h2>Quotations</h2>
      <button class="btn btn-primary" id="btn-new-qtn">+ New Quotation</button>
    </div>
    <div id="qtn-filter-bar" class="filter-bar">
      <input type="search" id="qtn-search" placeholder="Search by ID, customer…" class="search-input">
      <select id="qtn-status-filter">
        <option value="">All statuses</option>
        <option value="draft">Draft</option>
        <option value="sent">Sent</option>
        <option value="revised">Revised</option>
        <option value="won">Won</option>
        <option value="lost">Lost</option>
      </select>
    </div>
    <div id="qtn-table-area"></div>
  `;

  renderQuotationTable();

  document.getElementById('btn-new-qtn').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('ravasco:navigate', { detail: { view: 'enquiries', action: 'new', then_quote: true } }));
  });
  document.getElementById('qtn-search').addEventListener('input', renderQuotationTable);
  document.getElementById('qtn-status-filter').addEventListener('change', renderQuotationTable);
}

function renderQuotationTable() {
  const area = document.getElementById('qtn-table-area');
  if (!area) return;
  const search = (document.getElementById('qtn-search')?.value ?? '').toLowerCase();
  const statusFilter = document.getElementById('qtn-status-filter')?.value ?? '';

  const customers = Object.fromEntries(getAllCustomers(true).map(c => [c.id, c]));
  let quotations = storageGetAll('quotation.').sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  if (search) {
    quotations = quotations.filter(q =>
      q.id.toLowerCase().includes(search) ||
      (customers[q.customer_id]?.name ?? '').toLowerCase().includes(search)
    );
  }
  if (statusFilter) {
    quotations = quotations.filter(q => q.status === statusFilter);
  }

  if (quotations.length === 0) {
    area.innerHTML = '<p class="empty-state">No quotations found.</p>';
    return;
  }

  area.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Quotation ID</th>
          <th>Customer</th>
          <th>Belt Type</th>
          <th>Total Value</th>
          <th>Status</th>
          <th>Date</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${quotations.map(q => {
          const totalValue = (q.lines ?? []).reduce((sum, line) => {
            const price = line.result?.pricing?.cd_price_per_meter ?? 0;
            const len = (line.length_per_roll_m ?? 0) * (line.no_of_rolls ?? 0);
            return sum + price * len;
          }, 0);
          const beltNames = [...new Set((q.lines ?? []).map(l => l.belt_type_code))].join(', ');
          return `
            <tr>
              <td class="mono">${q.id}</td>
              <td>${escHtml(customers[q.customer_id]?.name ?? q.customer_id)}</td>
              <td>${escHtml(beltNames || '—')}</td>
              <td class="num">${totalValue > 0 ? formatRupees(totalValue) : '—'}</td>
              <td><span class="badge badge-${q.status}">${q.status}</span>${q.provisional ? '<span class="badge badge-provisional">Provisional</span>' : ''}</td>
              <td>${formatDate(q.created_at)}</td>
              <td>
                <button class="btn btn-sm" data-view="${q.id}">View</button>
                ${!['sent','revised','won','lost'].includes(q.status) ? `<button class="btn btn-sm" data-edit="${q.id}">Edit</button>` : ''}
                ${['sent','revised','won','lost'].includes(q.status) ? `<button class="btn btn-sm btn-outline" data-revise="${q.id}">Revise</button>` : ''}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  area.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('ravasco:navigate', { detail: { view: 'quotations', action: 'view', id: btn.dataset.view } })));
  });
  area.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('ravasco:navigate', { detail: { view: 'quotations', action: 'edit', id: btn.dataset.edit } })));
  });
  area.querySelectorAll('[data-revise]').forEach(btn => {
    btn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('ravasco:navigate', { detail: { view: 'quotations', action: 'revise', id: btn.dataset.revise } })));
  });
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
