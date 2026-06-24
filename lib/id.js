// lib/id.js
// ID generators using Indian financial year convention (FY runs Apr–Mar).
// IDs are sequential, zero-padded, and never reused.
// Source: Developer Prompt §7.

import { storageGet, storageSet } from './storage.js';

/** Return current Indian financial year as 'YYYY-YY' (e.g. '2025-26'). */
function currentFY() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  const startYear = month >= 4 ? year : year - 1;
  const endYY = String(startYear + 1).slice(2);
  return `${startYear}-${endYY}`;
}

/**
 * Get next sequential number for an entity, persisted in localStorage.
 * @param {string} counterKey - e.g. 'counter.customer'
 * @returns {number}
 */
function nextSeq(counterKey) {
  const current = storageGet(counterKey) ?? 0;
  const next = current + 1;
  storageSet(counterKey, next);
  return next;
}

/** Generate customer ID — CUS-NNNN. */
export function nextCustomerId() {
  const n = nextSeq('counter.customer');
  return `CUS-${String(n).padStart(4, '0')}`;
}

/** Generate supplier ID — SUP-NNNN. */
export function nextSupplierId() {
  const n = nextSeq('counter.supplier');
  return `SUP-${String(n).padStart(4, '0')}`;
}

/** Generate fabric supplier entry ID — FSP-NNNN. */
export function nextFabricSupplierId() {
  const n = nextSeq('counter.fabric_supplier');
  return `FSP-${String(n).padStart(4, '0')}`;
}

/** Generate belt rating ID — BRM-NNNN. */
export function nextBeltRatingId() {
  const n = nextSeq('counter.belt_rating');
  return `BRM-${String(n).padStart(4, '0')}`;
}

/** Generate currency ID — CUR-NNNN. */
export function nextCurrencyId() {
  const n = nextSeq('counter.currency');
  return `CUR-${String(n).padStart(4, '0')}`;
}

/** Generate enquiry ID — ENQ-YYYY-YY-DD-MM-HHmmss-NNNN. */
export function nextEnquiryId() {
  const n   = nextSeq('counter.enquiry');
  const now = new Date();
  const dd  = String(now.getDate()).padStart(2, '0');
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const HH  = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss  = String(now.getSeconds()).padStart(2, '0');
  return `ENQ-${currentFY()}-${dd}-${mm}-${HH}${min}${ss}-${String(n).padStart(4, '0')}`;
}

/** Generate quotation ID — QTN-YYYY-YY-NNNN. */
export function nextQuotationId() {
  const n = nextSeq('counter.quotation');
  return `QTN-${currentFY()}-${String(n).padStart(4, '0')}`;
}

/**
 * Generate revision ID from a base quotation ID — appends -R1, -R2, etc.
 * @param {string} baseId - e.g. 'QTN-2025-26-0128'
 * @param {number} revisionNumber - 1-based revision index.
 */
export function revisionId(baseId, revisionNumber) {
  return `${baseId}-R${revisionNumber}`;
}
