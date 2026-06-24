// lib/master_store.js
// Live masters layer: merges frozen JS seed data with localStorage overrides.
// Phase 0: enables Admin to create, edit, and archive master rows via the UI.
// The engine and form both read from here so admin changes take effect immediately.
//
// Storage keys:
//   master.compound.{id}           → compound row override/addition
//   master.breaker.{id}            → breaker row override/addition
//   master.packing.{id}            → reel/packing row override/addition
//   master.freight.{id}            → freight zone row override/addition
//   master.edge.{id}               → edge type row override/addition
//   pricehistory.compound.{id}     → [{ts, old_price, new_price, actor}]

import { storageGet, storageSet, storageGetAll } from './storage.js';
import { COMPOUND_MASTER }        from '../masters/compound_master.js';
import { BREAKER_MASTER }         from '../masters/breaker_master.js';
import { REEL_PACKING_MASTER }    from '../masters/reel_packing_master.js';
import { FREIGHT_STATE_MASTER }   from '../masters/freight_master.js';
import { EDGE_MASTER }            from '../masters/edge_master.js';

// ── Generic live-master getter ────────────────────────────────────────────────
// Returns the full set: frozen seed rows (with localStorage overrides merged in)
// PLUS any net-new rows added by admin (not in the frozen seed).
function getLiveMaster(prefix, frozenSeed) {
  const stored = storageGetAll(`master.${prefix}.`);
  if (stored.length === 0) {
    // No admin changes yet — return immutable copies of the seed
    return frozenSeed.map(r => ({ ...r }));
  }
  const overrideMap = {};
  stored.forEach(r => { if (r?.id) overrideMap[r.id] = r; });
  const seedIds = new Set(frozenSeed.map(r => r.id));
  // Net-new rows added by admin (not in frozen seed)
  const newEntries = stored.filter(r => r?.id && !seedIds.has(r.id));
  return [
    ...frozenSeed.map(r => overrideMap[r.id] ? { ...r, ...overrideMap[r.id] } : { ...r }),
    ...newEntries,
  ];
}

// ── Public getters ────────────────────────────────────────────────────────────
export function getLiveCompounds()  { return getLiveMaster('compound', COMPOUND_MASTER); }
export function getLiveBreakers()   { return getLiveMaster('breaker',  BREAKER_MASTER); }
export function getLivePacking()    { return getLiveMaster('packing',  REEL_PACKING_MASTER); }
export function getLiveFreight()    { return getLiveMaster('freight',  FREIGHT_STATE_MASTER); }
export function getLiveEdges()      { return getLiveMaster('edge',     EDGE_MASTER); }

// ── Save a master entry ───────────────────────────────────────────────────────
// For compound: automatically tracks price history when price_per_kg changes.
export function saveMasterEntry(prefix, entry, actor = 'Admin') {
  if (!entry?.id) throw new Error('saveMasterEntry: entry must have an id');

  // Price history tracking for compounds
  if (prefix === 'compound') {
    const existing = storageGet(`master.compound.${entry.id}`);
    const seedRow  = COMPOUND_MASTER.find(r => r.id === entry.id);
    const oldPrice = existing?.price_per_kg ?? seedRow?.price_per_kg ?? null;
    if (oldPrice != null && oldPrice !== entry.price_per_kg) {
      addPriceHistory(entry.id, oldPrice, entry.price_per_kg, actor);
    }
  }

  storageSet(`master.${prefix}.${entry.id}`, entry);
}

// ── Archive / restore an entry ────────────────────────────────────────────────
export function archiveMasterEntry(prefix, id, actor = 'Admin') {
  const liveEntries = getLiveMaster(prefix, _seedFor(prefix));
  const entry       = liveEntries.find(r => r.id === id);
  if (!entry) return;
  saveMasterEntry(prefix, { ...entry, active: false }, actor);
}

export function restoreMasterEntry(prefix, id, actor = 'Admin') {
  const liveEntries = getLiveMaster(prefix, _seedFor(prefix));
  const entry       = liveEntries.find(r => r.id === id);
  if (!entry) return;
  saveMasterEntry(prefix, { ...entry, active: true }, actor);
}

function _seedFor(prefix) {
  switch (prefix) {
    case 'compound':  return COMPOUND_MASTER;
    case 'breaker':   return BREAKER_MASTER;
    case 'packing':   return REEL_PACKING_MASTER;
    case 'freight':   return FREIGHT_STATE_MASTER;
    case 'edge':      return EDGE_MASTER;
    default:          return [];
  }
}

// ── Price history (compounds) ─────────────────────────────────────────────────
export function addPriceHistory(compoundId, oldPrice, newPrice, actor = 'Admin') {
  const key     = `pricehistory.compound.${compoundId}`;
  const history = storageGet(key) ?? [];
  history.unshift({        // newest first
    ts:        new Date().toISOString(),
    old_price: Number(oldPrice),
    new_price: Number(newPrice),
    actor,
  });
  storageSet(key, history);
}

export function getPriceHistory(compoundId) {
  return storageGet(`pricehistory.compound.${compoundId}`) ?? [];
}

// ── Generate a unique ID for a new master entry ───────────────────────────────
export function generateMasterId(prefix) {
  const all  = getLiveMaster(prefix, _seedFor(prefix));
  const nums = all
    .map(r => {
      const m = String(r.id).match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
  const next = (Math.max(0, ...nums) + 1);
  const padded = String(next).padStart(3, '0');
  switch (prefix) {
    case 'compound': return `CMP-CUSTOM-${padded}`;
    case 'breaker':  return `BRK-CUSTOM-${padded}`;
    case 'packing':  return `PKG-CUSTOM-${padded}`;
    case 'freight':  return `FRT-CUSTOM-${padded}`;
    case 'edge':     return `EDGE-CUSTOM-${padded}`;
    default:         return `${prefix.toUpperCase()}-${padded}`;
  }
}
