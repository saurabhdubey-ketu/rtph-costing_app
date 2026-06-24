// masters/currency_master.js
// Currency data access layer — CRUD for currency records persisted in localStorage.
// Each currency is stored under key 'currency.CUR-NNNN' via lib/storage.js.
// Exchange rates are entered manually by the user (INR per 1 unit of the currency).

import { storageGet, storageSet, storageGetAll } from '../lib/storage.js';
import { nextCurrencyId } from '../lib/id.js';
import { auditLog } from '../lib/audit.js';

export const CURRENCY_KEY_PREFIX = 'currency.';

export const CURRENCY_FIELDS = Object.freeze([
  'id',            // Auto-generated CUR-NNNN
  'code',          // ISO 4217 currency code — e.g. USD, EUR, GBP
  'name',          // Full name — e.g. US Dollar, Euro
  'symbol',        // Display symbol — e.g. $, €, £
  'exchange_rate', // INR per 1 unit of this currency (user entered)
  'active',        // boolean — soft-delete flag
  'created_at',    // ISO timestamp — set once at creation
  'updated_at',    // ISO timestamp — refreshed on every save
]);

// ---------------------------------------------------------------------------
// Seed defaults — INR is the base currency, always present
// ---------------------------------------------------------------------------
export const CURRENCY_DEFAULTS = Object.freeze([
  { id: 'CUR-0001', code: 'INR', name: 'Indian Rupee',   symbol: '₹', exchange_rate: 1 },
  { id: 'CUR-0002', code: 'USD', name: 'US Dollar',      symbol: '$', exchange_rate: 84 },
  { id: 'CUR-0003', code: 'EUR', name: 'Euro',           symbol: '€', exchange_rate: 91 },
  { id: 'CUR-0004', code: 'GBP', name: 'British Pound',  symbol: '£', exchange_rate: 107 },
]);

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Save a currency record.
 * Omit `id` to create a new record (ID auto-assigned).
 * Include an existing `id` to update that record.
 * @param {object} data
 * @returns {object} The saved record.
 */
export function saveCurrency(data) {
  const isNew    = !data.id;
  const id       = isNew ? nextCurrencyId() : data.id;
  const existing = isNew ? null : storageGet(`${CURRENCY_KEY_PREFIX}${id}`);

  const record = {
    id,
    code:          (data.code ?? '').trim().toUpperCase()  || null,
    name:          (data.name ?? '').trim()                || null,
    symbol:        (data.symbol ?? '').trim()              || null,
    exchange_rate: data.exchange_rate != null ? Number(data.exchange_rate) : null,
    active:        data.active !== false,
    created_at:    existing?.created_at ?? new Date().toISOString(),
    updated_at:    new Date().toISOString(),
  };

  storageSet(`${CURRENCY_KEY_PREFIX}${id}`, record);
  auditLog({ entity: 'currency', entity_id: id, action: isNew ? 'created' : 'edited', diff: record });
  return record;
}

/**
 * Load CURRENCY_DEFAULTS into localStorage for any record not already present.
 * Safe to call on every app start — existing records are never overwritten.
 */
export function initCurrencyDefaults() {
  const now = new Date().toISOString();
  for (const def of CURRENCY_DEFAULTS) {
    if (!storageGet(`${CURRENCY_KEY_PREFIX}${def.id}`)) {
      storageSet(`${CURRENCY_KEY_PREFIX}${def.id}`, {
        ...def,
        active:     true,
        created_at: now,
        updated_at: now,
      });
    }
  }
}

/**
 * Retrieve a single currency record by ID.
 * @param {string} id — e.g. 'CUR-0001'
 * @returns {object|null}
 */
export function getCurrency(id) {
  if (!id) return null;
  return storageGet(`${CURRENCY_KEY_PREFIX}${id}`);
}

/**
 * Retrieve a currency by its ISO code.
 * @param {string} code — e.g. 'USD'
 * @returns {object|null}
 */
export function getCurrencyByCode(code) {
  if (!code) return null;
  const q = code.trim().toUpperCase();
  return getAllCurrencies(true).find(c => c.code === q) ?? null;
}

/**
 * Retrieve all active currencies sorted by code.
 * @param {boolean} includeInactive — pass true to include archived records
 * @returns {object[]}
 */
export function getAllCurrencies(includeInactive = false) {
  const all = storageGetAll(CURRENCY_KEY_PREFIX).sort((a, b) =>
    (a.code ?? '').localeCompare(b.code ?? '')
  );
  return includeInactive ? all : all.filter(c => c.active !== false);
}

/**
 * Soft-delete a currency (sets active = false).
 * INR (CUR-0001) cannot be archived — it is the base currency.
 * @param {string} id
 * @returns {object|null} Updated record, or null if not found.
 */
export function deactivateCurrency(id) {
  const record = getCurrency(id);
  if (!record) return null;
  if (record.code === 'INR') throw new Error('INR is the base currency and cannot be archived.');
  return saveCurrency({ ...record, active: false });
}

/**
 * Check whether a currency with the given ID exists.
 * @param {string} id
 * @returns {boolean}
 */
export function currencyExists(id) {
  return getCurrency(id) !== null;
}
