// lib/audit.js
// Append-only audit log writer.
// Each entry: { ts, actor, entity, entity_id, action, diff }
// Source: Developer Prompt §10.

import { storageGet, storageSet } from './storage.js';

const LOG_KEY = 'audit.log';
const ACTOR = 'prototype-user';

/**
 * Append one audit entry to the log.
 * @param {object} entry
 * @param {string} entry.entity - 'customer' | 'enquiry' | 'quotation'
 * @param {string} entry.entity_id
 * @param {string} entry.action - 'created'|'edited'|'sent'|'revised'|'override_applied'|'error'
 * @param {object} [entry.diff] - Changed fields (before/after or delta).
 */
export function auditLog({ entity, entity_id, action, diff = {} }) {
  const log = storageGet(LOG_KEY) ?? [];
  log.push({
    ts: new Date().toISOString(),
    actor: ACTOR,
    entity,
    entity_id,
    action,
    diff,
  });
  storageSet(LOG_KEY, log);
}

/**
 * Read the full audit log, newest first.
 * @returns {Array}
 */
export function auditRead() {
  return (storageGet(LOG_KEY) ?? []).slice().reverse();
}

/**
 * Filter audit log entries.
 * @param {{ entity?: string, action?: string }} filter
 * @returns {Array}
 */
export function auditFilter({ entity, action } = {}) {
  return auditRead().filter(entry => {
    if (entity && entry.entity !== entity) return false;
    if (action && entry.action !== action) return false;
    return true;
  });
}
