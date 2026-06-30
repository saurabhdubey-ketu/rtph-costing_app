// server.js — Ravasco CDS
// Node.js server: static files + data persistence (db.json) + email sending
//
// Usage:  node server.js
// Data:   ./data/db.json            (app data, all ports share this)
// Email:  ./data/email-config.json  (SMTP credentials)

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT          = 5000;
const ROOT          = __dirname;
const DATA_DIR      = path.join(ROOT, 'data');
const DB_PATH       = path.join(DATA_DIR, 'db.json');
const EMAIL_CFG     = path.join(DATA_DIR, 'email-config.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Brand assets — loaded once at startup, embedded as data URIs in generated PDFs ──
const LOGO_PATH = path.join(ROOT, 'assets', 'icons', 'indus_logo.png');
const LOGO_DATA_URI = fs.existsSync(LOGO_PATH)
  ? `data:image/png;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}`
  : '';

// ── Email config helpers ──────────────────────────────────────────────────────
function readEmailCfg() {
  try { return JSON.parse(fs.readFileSync(EMAIL_CFG, 'utf-8')); }
  catch { return null; }
}
function writeEmailCfg(cfg) {
  fs.writeFileSync(EMAIL_CFG, JSON.stringify(cfg, null, 2), 'utf-8');
}

// ── Find a Chromium-based browser for PDF generation ─────────────────────────
const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function findBrowser() {
  const cfg = readEmailCfg();
  if (cfg?.browserPath && fs.existsSync(cfg.browserPath)) return cfg.browserPath;
  return BROWSER_PATHS.find(p => fs.existsSync(p)) ?? null;
}

// ── Generate PDF from HTML using Chrome/Edge + puppeteer-core ─────────────────
async function htmlToPdf(html) {
  const puppeteer = require('puppeteer-core');
  const executablePath = findBrowser();
  if (!executablePath) throw new Error('No browser found for PDF generation. Install Chrome or Edge.');

  // Inline brand assets — puppeteer's setContent has no base URL, so relative
  // paths won't resolve. Swap the canonical logo URL for a data URI so the
  // document is fully self-contained at render time.
  const inlined = LOGO_DATA_URI
    ? html.split('/assets/icons/indus_logo.png').join(LOGO_DATA_URI)
    : html;

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(inlined, { waitUntil: 'networkidle0', timeout: 30000 });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '13mm', right: '15mm', bottom: '13mm', left: '15mm' },
    });
  } finally {
    await browser.close();
  }
}

// ── Send email via nodemailer ─────────────────────────────────────────────────
async function sendEmail({ to, cc, subject, bodyText, html, quotationId }) {
  const cfg = readEmailCfg();
  if (!cfg?.host) throw new Error('SMTP not configured. Open the email modal and fill in your SMTP settings first.');

  const nodemailer = require('nodemailer');
  const transport  = nodemailer.createTransport({
    host:   cfg.host,
    port:   cfg.port  || 587,
    secure: cfg.secure || false,
    auth:   { user: cfg.user, pass: cfg.pass },
    tls:    { rejectUnauthorized: false },
  });

  const pdfBuffer = await htmlToPdf(html);

  await transport.sendMail({
    from:        `"${cfg.fromName || 'Ravasco Indus Belts'}" <${cfg.fromEmail || cfg.user}>`,
    to,
    cc:          cc || undefined,
    subject,
    text:        bodyText,
    html:        `<pre style="font-family:sans-serif;font-size:14px">${bodyText.replace(/</g,'&lt;')}</pre>`,
    attachments: [{ filename: `${quotationId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
  });
}

// ── db.json helpers ───────────────────────────────────────────────────────────
function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); }
  catch { return {}; }
}
function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

// ── HTTP body reader ──────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

// ── MIME types ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
};

// ── Request handler ───────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];

  // ── GET /api/data  — return full db.json ──────────────────────────────────
  if (req.method === 'GET' && url === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readDb()));
    return;
  }

  // ── POST /api/data  — upsert one key ─────────────────────────────────────
  if (req.method === 'POST' && url === '/api/data') {
    try {
      const { key, value } = JSON.parse(await readBody(req));
      const db = readDb();
      db[key] = value;
      writeDb(db);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // ── POST /api/data/remove  — delete one key ───────────────────────────────
  if (req.method === 'POST' && url === '/api/data/remove') {
    try {
      const { key } = JSON.parse(await readBody(req));
      const db = readDb();
      delete db[key];
      writeDb(db);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // ── POST /api/data/bulk  — set many keys (initial migration) ─────────────
  if (req.method === 'POST' && url === '/api/data/bulk') {
    try {
      const payload = JSON.parse(await readBody(req));
      const db = readDb();
      Object.assign(db, payload);
      writeDb(db);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // ── GET /api/email-config  — return config (password masked) ─────────────
  if (req.method === 'GET' && url === '/api/email-config') {
    const cfg = readEmailCfg();
    if (!cfg) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('null'); return; }
    const safe = { ...cfg, pass: cfg.pass ? '••••••••' : '' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(safe));
    return;
  }

  // ── POST /api/email-config  — save SMTP settings ──────────────────────────
  if (req.method === 'POST' && url === '/api/email-config') {
    try {
      const incoming = JSON.parse(await readBody(req));
      // Keep existing password if incoming is masked placeholder
      const existing = readEmailCfg() || {};
      const cfg = {
        host:        incoming.host        || '',
        port:        Number(incoming.port)  || 587,
        secure:      !!incoming.secure,
        user:        incoming.user        || '',
        pass:        (incoming.pass && incoming.pass !== '••••••••') ? incoming.pass : (existing.pass || ''),
        fromName:    incoming.fromName    || 'Ravasco Indus Belts',
        fromEmail:   incoming.fromEmail   || incoming.user || '',
        browserPath: incoming.browserPath || '',
      };
      writeEmailCfg(cfg);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // ── POST /api/send-quotation-email  — generate PDF + send email ───────────
  if (req.method === 'POST' && url === '/api/send-quotation-email') {
    try {
      const payload = JSON.parse(await readBody(req));
      await sendEmail(payload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // ── POST /api/pdf  — generate PDF and stream as download ─────────────────
  if (req.method === 'POST' && url === '/api/pdf') {
    try {
      const { html, filename } = JSON.parse(await readBody(req));
      const pdfBuffer = await htmlToPdf(html);
      const safe = (filename || 'quotation').replace(/[^a-zA-Z0-9\-_. ]/g, '_');
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safe}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });
      res.end(pdfBuffer);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  // ── Static file serving ───────────────────────────────────────────────────
  const filePath = path.resolve(ROOT, url === '/' ? 'index.html' : url.slice(1));

  // Block directory traversal
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, 'index.html')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  try {
    const data = fs.readFileSync(filePath);
    const mime = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  ✓ Ravasco CDS  →  http://localhost:${PORT}`);
  console.log(`  ✓ Data file    →  ${DB_PATH}`);
  console.log(`  ✓ Data persists across ports and sessions via db.json\n`);
});
