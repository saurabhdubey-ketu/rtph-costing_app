// lib/email_modal.js
// Email compose modal — sends the quotation PDF to the customer via SMTP.
// Shows an inline SMTP settings form if email hasn't been configured yet.

import { getQuotationHTML } from './print_pdf.js';

// ── Public entry point ────────────────────────────────────────────────────────

export async function openEmailModal(quotation, result) {
  if (!quotation || !result) return;

  const info = getQuotationHTML(quotation, result);
  if (!info) return;

  const { html: printHtml, cName, cEmail, combinedRating, inputs, derived } = info;

  // Pre-fill subject and body
  const widthStr  = inputs.width_mm ? `${inputs.width_mm} mm` : '';
  const lenStr    = derived.total_length_m ? `${Number(derived.total_length_m).toFixed(0)} m` : '';
  const subject   = `Quotation ${quotation.id} – ${widthStr} ${combinedRating} Belt | Ravasco Indus Belts`;
  const bodyText  = [
    `Dear ${cName},`,
    '',
    `Please find attached our Quotation ${quotation.id} for your belt requirement.`,
    '',
    `Specification:`,
    `  • Fabric Rating  : ${combinedRating}`,
    `  • Belt Width     : ${widthStr}`,
    `  • Total Length   : ${lenStr}`,
    '',
    `Kindly review the attached PDF and revert with your confirmation or feedback.`,
    '',
    `Best regards,`,
    `Ravasco Indus Belts`,
  ].join('\n');

  // Remove any stale overlay
  document.getElementById('ravasco-email-overlay')?.remove();

  // Load current SMTP config to decide which panel to show first
  let smtpCfg = null;
  try {
    const r = await fetch('/api/email-config');
    if (r.ok) smtpCfg = await r.json();
  } catch {}

  const needsSetup = !smtpCfg?.host;

  const overlay = document.createElement('div');
  overlay.id = 'ravasco-email-overlay';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column',
    'background:rgba(0,0,0,.55);align-items:center;justify-content:center;padding:20px',
  ].join(';');

  overlay.innerHTML = `
    <div id="ravasco-email-box" style="
      background:#fff;border-radius:8px;width:100%;max-width:560px;
      box-shadow:0 8px 40px rgba(0,0,0,.32);display:flex;flex-direction:column;
      max-height:90vh;overflow:hidden;">

      <!-- Header -->
      <div style="background:#0F2A44;color:#fff;padding:12px 20px;display:flex;
                  justify-content:space-between;align-items:center;flex-shrink:0">
        <span style="font-weight:700;font-size:14px">&#9993;&nbsp; Send Quotation by Email</span>
        <button id="ravasco-email-close"
          style="background:none;border:1px solid rgba(255,255,255,.4);color:#fff;
                 padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px">&#10005; Close</button>
      </div>

      <!-- Scrollable body -->
      <div style="overflow-y:auto;flex:1;padding:20px 24px">

        <!-- SMTP setup panel (shown when not configured) -->
        <div id="smtp-panel" style="display:${needsSetup ? 'block' : 'none'}">
          <p style="margin:0 0 12px;font-size:13px;color:#555">
            &#9888;&nbsp; Email is not configured yet. Enter your SMTP settings once and they will be saved.
          </p>
          ${smtpFormHtml(smtpCfg)}
          <button id="btn-save-smtp" class="btn btn-primary" style="margin-top:4px">Save SMTP Settings</button>
          <button id="btn-smtp-done" class="btn btn-ghost" style="margin-top:4px;display:${needsSetup ? 'none' : 'inline-block'}">
            &#8592; Back to Email
          </button>
          <hr style="margin:18px 0;border:none;border-top:1px solid #e5e9ee">
        </div>

        <!-- Compose panel -->
        <div id="compose-panel" style="display:${needsSetup ? 'none' : 'block'}">
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">To *</label>
            <input id="em-to" type="email" value="${esc(cEmail !== '—' ? cEmail : '')}"
              style="width:100%;padding:7px 10px;border:1px solid #d1d9e0;border-radius:4px;font-size:13px;box-sizing:border-box">
          </div>
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">CC</label>
            <input id="em-cc" type="email" placeholder="Optional"
              style="width:100%;padding:7px 10px;border:1px solid #d1d9e0;border-radius:4px;font-size:13px;box-sizing:border-box">
          </div>
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">Subject *</label>
            <input id="em-subject" type="text" value="${esc(subject)}"
              style="width:100%;padding:7px 10px;border:1px solid #d1d9e0;border-radius:4px;font-size:13px;box-sizing:border-box">
          </div>
          <div style="margin-bottom:4px">
            <label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">Message</label>
            <textarea id="em-body" rows="10"
              style="width:100%;padding:7px 10px;border:1px solid #d1d9e0;border-radius:4px;font-size:12.5px;
                     font-family:monospace;resize:vertical;box-sizing:border-box">${esc(bodyText)}</textarea>
          </div>
          <div style="font-size:11.5px;color:#6b7280;margin-bottom:12px">
            &#128206;&nbsp; Quotation PDF will be attached automatically.
          </div>
          <div id="em-error" style="color:#b91c1c;font-size:12.5px;margin-bottom:8px;display:none"></div>
        </div>

      </div>

      <!-- Footer actions -->
      <div style="padding:12px 24px;border-top:1px solid #e5e9ee;display:flex;
                  justify-content:space-between;align-items:center;flex-shrink:0;background:#f8fafd">
        <button id="btn-smtp-toggle"
          style="background:none;border:none;color:#0F2A44;font-size:12px;cursor:pointer;text-decoration:underline;padding:0">
          ${needsSetup ? '' : '&#9881;&nbsp;SMTP Settings'}
        </button>
        <div style="display:flex;gap:8px">
          <button id="btn-email-cancel" class="btn btn-ghost">Cancel</button>
          <button id="btn-email-send" class="btn btn-primary" style="${needsSetup ? 'display:none' : ''}">
            &#9993;&nbsp; Send Email
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // ── Wire events ───────────────────────────────────────────────────────────

  const close = () => overlay.remove();
  overlay.querySelector('#ravasco-email-close').addEventListener('click', close);
  overlay.querySelector('#btn-email-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // SMTP toggle
  const smtpPanel    = overlay.querySelector('#smtp-panel');
  const composePanel = overlay.querySelector('#compose-panel');
  const sendBtn      = overlay.querySelector('#btn-email-send');
  const toggleBtn    = overlay.querySelector('#btn-smtp-toggle');

  toggleBtn.addEventListener('click', () => {
    const showing = smtpPanel.style.display !== 'none';
    smtpPanel.style.display    = showing ? 'none'  : 'block';
    composePanel.style.display = showing ? 'block' : 'none';
    sendBtn.style.display      = showing ? ''      : 'none';
    toggleBtn.innerHTML        = showing ? '&#9881;&nbsp;SMTP Settings' : '&#8592;&nbsp;Back to Email';
  });

  // Back button inside SMTP panel
  overlay.querySelector('#btn-smtp-done')?.addEventListener('click', () => {
    smtpPanel.style.display    = 'none';
    composePanel.style.display = 'block';
    sendBtn.style.display      = '';
    toggleBtn.innerHTML        = '&#9881;&nbsp;SMTP Settings';
  });

  // Save SMTP
  overlay.querySelector('#btn-save-smtp').addEventListener('click', async () => {
    const cfg = collectSmtpForm(overlay);
    if (!cfg.host || !cfg.user || !cfg.pass) {
      alert('Host, Username, and Password are required.');
      return;
    }
    const btn = overlay.querySelector('#btn-save-smtp');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const r = await fetch('/api/email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      btn.disabled = false; btn.textContent = 'Save SMTP Settings';
      overlay.querySelector('#btn-smtp-done').style.display = 'inline-block';
      // Show compose panel
      smtpPanel.style.display    = 'none';
      composePanel.style.display = 'block';
      sendBtn.style.display      = '';
      toggleBtn.innerHTML        = '&#9881;&nbsp;SMTP Settings';
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Save SMTP Settings';
      alert(`Failed to save: ${e.message}`);
    }
  });

  // Send email
  overlay.querySelector('#btn-email-send').addEventListener('click', async () => {
    const to      = overlay.querySelector('#em-to').value.trim();
    const cc      = overlay.querySelector('#em-cc').value.trim();
    const subject = overlay.querySelector('#em-subject').value.trim();
    const body    = overlay.querySelector('#em-body').value.trim();
    const errEl   = overlay.querySelector('#em-error');

    errEl.style.display = 'none';
    if (!to)      { errEl.textContent = 'To address is required.'; errEl.style.display = ''; return; }
    if (!subject) { errEl.textContent = 'Subject is required.';    errEl.style.display = ''; return; }

    const btn = overlay.querySelector('#btn-email-send');
    btn.disabled = true;
    btn.innerHTML = '<span style="opacity:.7">Generating PDF &amp; sending…</span>';

    try {
      const r = await fetch('/api/send-quotation-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to, cc: cc || null, subject, bodyText: body,
          html: printHtml,
          quotationId: quotation.id,
        }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || 'Unknown error');
      overlay.remove();
      window.dispatchEvent(new CustomEvent('ravasco:toast', {
        detail: { msg: `Email sent to ${to}` },
      }));
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = '&#9993;&nbsp; Send Email';
      errEl.textContent = `Failed: ${e.message}`;
      errEl.style.display = '';
    }
  });
}

// ── SMTP form helpers ─────────────────────────────────────────────────────────

function smtpFormHtml(cfg) {
  const v = s => esc(s ?? '');
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="grid-column:1/-1">
        <label style="font-size:12px;font-weight:600;color:#374151">SMTP Host *
          <span style="font-weight:400;color:#6b7280"> (e.g. smtp.gmail.com, smtp.office365.com)</span></label>
        <input id="smtp-host" value="${v(cfg?.host)}"
          style="width:100%;padding:6px 9px;border:1px solid #d1d9e0;border-radius:4px;font-size:13px;margin-top:3px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;color:#374151">Port *</label>
        <input id="smtp-port" type="number" value="${v(cfg?.port || 587)}"
          style="width:100%;padding:6px 9px;border:1px solid #d1d9e0;border-radius:4px;font-size:13px;margin-top:3px;box-sizing:border-box">
      </div>
      <div style="display:flex;align-items:center;gap:6px;padding-top:20px">
        <input id="smtp-secure" type="checkbox" ${cfg?.secure ? 'checked' : ''}>
        <label for="smtp-secure" style="font-size:12px;font-weight:600;color:#374151">SSL (port 465)</label>
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;color:#374151">Username (your email) *</label>
        <input id="smtp-user" type="email" value="${v(cfg?.user)}"
          style="width:100%;padding:6px 9px;border:1px solid #d1d9e0;border-radius:4px;font-size:13px;margin-top:3px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;color:#374151">Password / App Password *</label>
        <input id="smtp-pass" type="password" value="${v(cfg?.pass)}" placeholder="App password for Gmail/M365"
          style="width:100%;padding:6px 9px;border:1px solid #d1d9e0;border-radius:4px;font-size:13px;margin-top:3px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;color:#374151">From Name</label>
        <input id="smtp-fromName" value="${v(cfg?.fromName || 'Ravasco Indus Belts')}"
          style="width:100%;padding:6px 9px;border:1px solid #d1d9e0;border-radius:4px;font-size:13px;margin-top:3px;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;color:#374151">From Email</label>
        <input id="smtp-fromEmail" type="email" value="${v(cfg?.fromEmail)}" placeholder="Defaults to username"
          style="width:100%;padding:6px 9px;border:1px solid #d1d9e0;border-radius:4px;font-size:13px;margin-top:3px;box-sizing:border-box">
      </div>
    </div>
    <details style="margin-top:12px">
      <summary style="font-size:12px;color:#6b7280;cursor:pointer">Advanced: Browser path for PDF (auto-detects Edge)</summary>
      <input id="smtp-browserPath" value="${v(cfg?.browserPath)}" placeholder="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
        style="width:100%;padding:6px 9px;border:1px solid #d1d9e0;border-radius:4px;font-size:12px;margin-top:6px;box-sizing:border-box">
    </details>
    <div style="margin-top:10px;padding:8px 10px;background:#f0f4f8;border-radius:4px;font-size:11.5px;color:#374151">
      <strong>Gmail:</strong> Enable 2FA → use an <em>App Password</em> (not your regular password).<br>
      <strong>Outlook/M365:</strong> smtp.office365.com, port 587, use your Office 365 credentials.
    </div>`;
}

function collectSmtpForm(container) {
  return {
    host:        container.querySelector('#smtp-host')?.value.trim()      || '',
    port:        Number(container.querySelector('#smtp-port')?.value)      || 587,
    secure:      container.querySelector('#smtp-secure')?.checked          || false,
    user:        container.querySelector('#smtp-user')?.value.trim()       || '',
    pass:        container.querySelector('#smtp-pass')?.value              || '',
    fromName:    container.querySelector('#smtp-fromName')?.value.trim()   || '',
    fromEmail:   container.querySelector('#smtp-fromEmail')?.value.trim()  || '',
    browserPath: container.querySelector('#smtp-browserPath')?.value.trim()|| '',
  };
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
