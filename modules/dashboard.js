// modules/dashboard.js
// Dashboard — summary counts, recent quotations, audit activity.

import { storageGetAll } from '../lib/storage.js';
import { getAllCustomers } from '../masters/customer_master.js';
import { auditRead } from '../lib/audit.js';
import { formatDate, formatRupees } from '../lib/formatter.js';

export function renderDashboard(container) {
  const customers  = getAllCustomers(true);
  const enquiries  = storageGetAll('enquiry.');
  const quotations = storageGetAll('quotation.');
  const auditLog   = auditRead().slice(0, 10);

  const draftCount  = quotations.filter(q => q.status === 'draft').length;
  const sentCount   = quotations.filter(q => q.status === 'sent' || q.status === 'revised').length;
  const wonCount    = quotations.filter(q => q.status === 'won').length;

  const recentQuotations = quotations
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

  container.innerHTML = `
    <div class="page-header"><h2>Dashboard</h2></div>

    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-value">${customers.length}</div>
        <div class="stat-label">Customers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${enquiries.length}</div>
        <div class="stat-label">Enquiries</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${quotations.length}</div>
        <div class="stat-label">Quotations</div>
      </div>
      <div class="stat-card stat-highlight">
        <div class="stat-value">${draftCount}</div>
        <div class="stat-label">Draft</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${sentCount}</div>
        <div class="stat-label">Sent</div>
      </div>
      <div class="stat-card stat-accent">
        <div class="stat-value">${wonCount}</div>
        <div class="stat-label">Won</div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="card">
        <h3>Recent Quotations</h3>
        ${recentQuotations.length === 0
          ? '<p class="empty-state">No quotations yet.</p>'
          : `<table class="data-table">
              <thead><tr><th>ID</th><th>Customer</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody>
                ${recentQuotations.map(q => `
                  <tr>
                    <td class="mono"><a href="#" data-qtn="${q.id}">${q.id}</a></td>
                    <td>${escHtml(customerMap[q.customer_id]?.name ?? q.customer_id)}</td>
                    <td><span class="badge badge-${q.status}">${q.status}</span></td>
                    <td>${formatDate(q.updated_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>

      <div class="card">
        <h3>Recent Activity</h3>
        ${auditLog.length === 0
          ? '<p class="empty-state">No activity yet.</p>'
          : `<table class="data-table">
              <thead><tr><th>Time</th><th>Entity</th><th>Action</th><th>ID</th></tr></thead>
              <tbody>
                ${auditLog.map(e => `
                  <tr>
                    <td>${e.ts?.slice(11,19) ?? ''}</td>
                    <td>${e.entity}</td>
                    <td><span class="badge badge-action">${e.action}</span></td>
                    <td class="mono">${e.entity_id}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>
    </div>
  `;

  container.querySelectorAll('[data-qtn]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('ravasco:navigate', { detail: { view: 'quotations', action: 'view', id: a.dataset.qtn } }));
    });
  });
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
