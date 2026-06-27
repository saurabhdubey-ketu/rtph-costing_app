// lib/storage.js
// localStorage wrapper with namespaced keys.
// All keys are prefixed 'ravasco.' to avoid collisions.

const PREFIX = 'ravasco.';

/**
 * @param {string} key - Unprefixed key (e.g. 'customer.CUS-0001').
 * @param {*} value - JSON-serialisable value.
 */
export function storageSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    throw new Error(`storageSet failed for key "${key}": ${e.message}`);
  }
  // Persist to server so data survives port changes
  fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: PREFIX + key, value }),
  }).catch(() => {});
}

/**
 * @param {string} key
 * @returns {*} Parsed value, or null if not found.
 */
export function storageGet(key) {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`storageGet parse error for key "${key}": ${e.message}`);
  }
}

/** @param {string} key */
export function storageRemove(key) {
  localStorage.removeItem(PREFIX + key);
  fetch('/api/data/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: PREFIX + key }),
  }).catch(() => {});
}

/**
 * Return all keys (unprefixed) whose prefixed name starts with `prefix`.
 * @param {string} prefix - e.g. 'customer.'
 * @returns {string[]}
 */
export function storageKeys(prefix) {
  const full = PREFIX + prefix;
  const result = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(full)) {
      result.push(k.slice(PREFIX.length));
    }
  }
  return result;
}

/**
 * Return all parsed values for keys starting with `prefix`.
 * @param {string} prefix
 * @returns {Array}
 */
export function storageGetAll(prefix) {
  return storageKeys(prefix).map(k => storageGet(k)).filter(Boolean);
}
