// masters/belt_rating_master.js
// Belt Rating Master — CRUD for belt rating combinations persisted in localStorage.
// Each record = one rating entry: fabric_type + per_ply_rating + number_of_plies.
//
// Code format: {fabric_type}-{per_ply_rating}-{no_of_plies}  e.g. NN-315-3
//   fabric_type     → ref to FABRIC_TYPE_MASTER
//   per_ply_rating  → ref to FABRIC_RATE_MASTER grades (kN/m per ply)
//   no_of_plies     → number of fabric plies in the belt
//   total_rating    → per_ply_rating × no_of_plies  (kN/m) — calculated at save, used in all calcs
//
// MEASURING SYSTEMS:
//   Metric   → primary; all calculation engine inputs/outputs use metric values.
//   Imperial → display only; stored but never used in calculations.
//              Values are null until the business provides confirmed imperial data.
//
// Stored under key 'belt_rating.BRM-NNNN' via lib/storage.js.
// Call initBeltRatingDefaults() once at app start.

import { storageGet, storageSet, storageGetAll } from '../lib/storage.js';
import { nextBeltRatingId } from '../lib/id.js';
import { auditLog } from '../lib/audit.js';

export const BELT_RATING_KEY_PREFIX = 'belt_rating.';

// Canonical field list. Imperial sub-object is display-only.
export const BELT_RATING_FIELDS = Object.freeze([
  'id',             // Auto-generated BRM-NNNN
  'code',           // Derived label  e.g. 'NN-315-3'
  'fabric_type',    // e.g. 'NN', 'EP' — ref to FABRIC_TYPE_MASTER
  'per_ply_rating', // kN/m per ply    — ref to FABRIC_RATE_MASTER grades
  'no_of_plies',    // number of plies
  'total_rating',   // kN/m — per_ply_rating × no_of_plies (metric, used in calcs)
  'imperial',       // Object { total_rating_piw } — display only, null until confirmed
  'active',         // boolean — soft-delete flag
  'created_at',     // ISO timestamp — set once at creation
  'updated_at',     // ISO timestamp — refreshed on every save
]);

/*
  imperial shape (display only — never used in calculation engine):
  {
    total_rating_piw: number | null,   // PIW (Pounds per Inch Width)
  }
*/

// ---------------------------------------------------------------------------
// Seed records — examples from the mind map
// ---------------------------------------------------------------------------
export const BELT_RATING_DEFAULTS = Object.freeze([
  { id: 'BRM-0001', fabric_type: 'NN', per_ply_rating: 315, no_of_plies: 3 },
  { id: 'BRM-0002', fabric_type: 'NN', per_ply_rating: 400, no_of_plies: 4 },
  { id: 'BRM-0003', fabric_type: 'EP', per_ply_rating: 630, no_of_plies: 4 },
  { id: 'BRM-0004', fabric_type: 'SW', per_ply_rating: 800, no_of_plies: 1 },
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive the display code from fabric_type + per_ply_rating + no_of_plies. */
function deriveCode(fabric_type, per_ply_rating, no_of_plies) {
  if (!fabric_type || per_ply_rating == null || no_of_plies == null) return null;
  return `${fabric_type}-${per_ply_rating}-${no_of_plies}`;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Save a belt rating record.
 * Omit `id` to create (BRM-NNNN auto-assigned). Include existing `id` to update.
 * total_rating is always recalculated from per_ply_rating × no_of_plies on save.
 * @param {object} data
 * @returns {object} The saved record.
 */
export function saveBeltRating(data) {
  const isNew = !data.id;
  const id = isNew ? nextBeltRatingId() : data.id;
  const existing = isNew ? null : storageGet(`${BELT_RATING_KEY_PREFIX}${id}`);

  const fabric_type    = data.fabric_type?.trim().toUpperCase()  || null;
  const per_ply_rating = data.per_ply_rating != null ? Number(data.per_ply_rating) : null;
  const no_of_plies    = data.no_of_plies    != null ? Number(data.no_of_plies)    : null;
  const total_rating   = (per_ply_rating != null && no_of_plies != null)
                         ? per_ply_rating * no_of_plies
                         : null;

  const record = {
    id,
    code:           deriveCode(fabric_type, per_ply_rating, no_of_plies),
    fabric_type,
    per_ply_rating,
    no_of_plies,
    total_rating,                           // metric kN/m — used in all calculations
    imperial: {
      total_rating_piw: data.imperial?.total_rating_piw ?? null,   // display only
    },
    active:     data.active !== false,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  storageSet(`${BELT_RATING_KEY_PREFIX}${id}`, record);
  auditLog({ entity: 'belt_rating', entity_id: id, action: isNew ? 'created' : 'edited', diff: record });
  return record;
}

/**
 * Load BELT_RATING_DEFAULTS into localStorage for any entry not already present.
 * Safe to call on every app start — existing records are never overwritten.
 */
export function initBeltRatingDefaults() {
  const now = new Date().toISOString();
  for (const def of BELT_RATING_DEFAULTS) {
    if (!storageGet(`${BELT_RATING_KEY_PREFIX}${def.id}`)) {
      const per_ply_rating = Number(def.per_ply_rating);
      const no_of_plies    = Number(def.no_of_plies);
      storageSet(`${BELT_RATING_KEY_PREFIX}${def.id}`, {
        id:              def.id,
        code:            deriveCode(def.fabric_type, per_ply_rating, no_of_plies),
        fabric_type:     def.fabric_type,
        per_ply_rating,
        no_of_plies,
        total_rating:    per_ply_rating * no_of_plies,
        imperial:        { total_rating_piw: null },
        active:          true,
        created_at:      now,
        updated_at:      now,
      });
    }
  }
}

/**
 * Retrieve a single belt rating by ID.
 * @param {string} id - e.g. 'BRM-0001'
 * @returns {object|null}
 */
export function getBeltRating(id) {
  if (!id) return null;
  return storageGet(`${BELT_RATING_KEY_PREFIX}${id}`);
}

/**
 * Retrieve all active belt ratings sorted by fabric_type then total_rating.
 * @param {boolean} includeInactive
 * @returns {object[]}
 */
export function getAllBeltRatings(includeInactive = false) {
  const all = storageGetAll(BELT_RATING_KEY_PREFIX).sort((a, b) =>
    (a.fabric_type ?? '').localeCompare(b.fabric_type ?? '') ||
    (a.total_rating ?? 0) - (b.total_rating ?? 0)
  );
  return includeInactive ? all : all.filter(r => r.active !== false);
}

/**
 * Return all ratings for a specific fabric type.
 * @param {string} fabricType - e.g. 'NN'
 * @returns {object[]}
 */
export function getBeltRatingsByType(fabricType) {
  return getAllBeltRatings().filter(r => r.fabric_type === fabricType);
}

/**
 * Search ratings by code, fabric type, or numeric rating values
 * (case-insensitive partial match on code/type; numeric match on ratings).
 * Returns all when query is blank.
 * @param {string} query
 * @returns {object[]}
 */
export function searchBeltRatings(query) {
  if (!query?.trim()) return getAllBeltRatings();
  const q = query.toLowerCase();
  return getAllBeltRatings().filter(r =>
    r.code?.toLowerCase().includes(q)        ||
    r.fabric_type?.toLowerCase().includes(q) ||
    String(r.per_ply_rating).includes(q)     ||
    String(r.total_rating).includes(q)
  );
}

/**
 * Soft-delete a belt rating (sets active = false).
 * @param {string} id
 * @returns {object|null} Updated record.
 */
export function deactivateBeltRating(id) {
  const record = getBeltRating(id);
  if (!record) return null;
  return saveBeltRating({ ...record, active: false });
}

/**
 * Check whether a belt rating with the given ID exists.
 * @param {string} id
 * @returns {boolean}
 */
export function beltRatingExists(id) {
  return getBeltRating(id) !== null;
}
