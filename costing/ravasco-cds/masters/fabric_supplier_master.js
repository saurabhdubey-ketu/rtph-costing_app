// masters/fabric_supplier_master.js
// Fabric supplier entry master — CRUD for fabric material entries persisted in localStorage.
// Each record = one fabric entry: a supplier + fabric type + ply rating combination.
//
// DATA SOURCES — what is stored vs. what is resolved at runtime:
//   supplier_id             → stored FK; resolves supplier_name, supplier_code,
//                             address, and location from supplier_master.js
//   supplier_location       → snapshot of Supplier Master address.field_1/city
//                             stored on save so display works without re-lookup
//   fabric_type             → stored code ('NN', 'EP' …); resolves full type
//                             details from fabric_type_master.js
//   supplier_material_code  → stored; the code the supplier uses for this fabric
//   internal_material_code  → stored; Ravasco's internal code (user-provided)
//   specifications[].gsm    → snapshotted from fabric_rate_master.js at save time
//                             (keyed by fabric_type + ply_rating)
//   specifications[].thickness_mm → same
//   specifications[].description  → user-provided (TDS reference text)
//
// Call initFabricSupplierDefaults() once at app start.

import { storageGet, storageSet, storageGetAll } from '../lib/storage.js';
import { nextFabricSupplierId } from '../lib/id.js';
import { auditLog } from '../lib/audit.js';

export const FABRIC_SUPPLIER_KEY_PREFIX = 'fabric_supplier.';

// Backward-compat: static company list — used by any existing dropdown that only
// needs supplier name + short code. Keep in sync with Supplier Master seed data.
export const FABRIC_SUPPLIER_MASTER = Object.freeze([
  { id: 'SUP-INDUS',     code: 'INDUS',     name: 'Indus (In-house)'  },
  { id: 'SUP-MIT',       code: 'MIT',       name: 'MIT'               },
  { id: 'SUP-SRF',       code: 'SRF',       name: 'SRF'               },
  { id: 'SUP-FENNER',    code: 'FENNER',    name: 'Fenner India'      },
  { id: 'SUP-YOKOHAMA',  code: 'YOKOHAMA',  name: 'Yokohama'          },
  { id: 'SUP-BRIDGESTO', code: 'BRIDGESTO', name: 'Bridgestone'       },
]);

// Canonical top-level field list for CRUD records.
export const FABRIC_SUPPLIER_FIELDS = Object.freeze([
  'id',                      // Auto-generated FSP-NNNN
  'supplier_id',             // FK → Supplier Master (SUP-NNNN)
                             //   resolves: supplier_name, supplier_code, address
  'supplier_location',       // Snapshot of selected location from Supplier Master
                             //   (address.field_1 or address.city at save time)
  'fabric_make',             // Object { make, short_form } — user-entered
  'fabric_type',             // e.g. 'NN', 'EP' — ref to FABRIC_TYPE_MASTER
  'supplier_material_code',  // Supplier's code for this fabric  e.g. 'NN-100'
  'internal_material_code',  // Ravasco internal code  e.g. 'NN100WH' — user-provided
  'specifications',          // Array of { description, gsm, thickness_mm }
                             //   gsm + thickness_mm snapshotted from FABRIC_RATE_MASTER
  'ply_rating',              // Individual ply rating  e.g. 100
  'active',                  // boolean — soft-delete flag
  'created_at',              // ISO timestamp — set once at creation
  'updated_at',              // ISO timestamp — refreshed on every save
]);

/*
  fabric_make shape:
  {
    make:       string | null,   // full make / origin name  e.g. 'Wuhu China'
    short_form: string | null,   // abbreviation             e.g. 'WH'
  }

  specifications[] element shape:
  {
    description:  string | null,  // user-provided TDS reference text
    gsm:          number | null,  // snapshotted from FABRIC_RATE_MASTER at save
    thickness_mm: number | null,  // snapshotted from FABRIC_RATE_MASTER at save
  }

  Operations:
    Search  → searchFabricSuppliers(query)
    Add     → saveFabricSupplier(data)              no id  → FSP-NNNN assigned
    Modify  → saveFabricSupplier(data)              with id → updates record
              caller controls Save / Cancel in UI
    Delete  → deactivateFabricSupplier(id)          soft-delete (active = false)
*/

// ---------------------------------------------------------------------------
// Seed records — only MIT (SUP-0001) and SRF (SUP-0002) have known Supplier
// Master IDs. Other companies should be added via the Add flow once their
// Supplier Master records are created.
// ---------------------------------------------------------------------------
export const FABRIC_SUPPLIER_DEFAULTS = Object.freeze([
  {
    id:                     'FSP-0001',
    supplier_id:            'SUP-0001',   // MIT in Supplier Master
    supplier_location:      'Dadra Unit',
    fabric_make:            { make: null, short_form: 'MIT' },
    fabric_type:            null,
    supplier_material_code: null,
    internal_material_code: null,
    specifications:         [],
    ply_rating:             null,
  },
  {
    id:                     'FSP-0002',
    supplier_id:            'SUP-0002',   // SRF in Supplier Master
    supplier_location:      'Gummidipoondi',
    fabric_make:            { make: null, short_form: 'SRF' },
    fabric_type:            null,
    supplier_material_code: null,
    internal_material_code: null,
    specifications:         [],
    ply_rating:             null,
  },
]);

// ---------------------------------------------------------------------------
// Internal builders
// ---------------------------------------------------------------------------

function buildFabricMake(m = {}) {
  return {
    make:       m.make?.trim()       || null,
    short_form: m.short_form?.trim() || null,
  };
}

function buildSpecifications(specs) {
  if (!Array.isArray(specs)) return [];
  return specs.map(s => ({
    description:  s.description?.trim()                              || null,
    gsm:          s.gsm          != null ? Number(s.gsm)            : null,
    thickness_mm: s.thickness_mm != null ? Number(s.thickness_mm)   : null,
  }));
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Save a fabric supplier entry.
 * Omit `id` to create (FSP-NNNN auto-assigned). Include existing `id` to update.
 *
 * Pass resolved gsm/thickness_mm inside each specification — the caller is
 * responsible for looking these up from FABRIC_RATE_MASTER before saving.
 *
 * @param {object} data
 * @returns {object} The saved record.
 */
export function saveFabricSupplier(data) {
  const isNew = !data.id;
  const id = isNew ? nextFabricSupplierId() : data.id;
  const existing = isNew ? null : storageGet(`${FABRIC_SUPPLIER_KEY_PREFIX}${id}`);

  const record = {
    id,
    supplier_id:            data.supplier_id?.trim()                    || null,
    supplier_location:      data.supplier_location?.trim()              || null,
    fabric_make:            buildFabricMake(data.fabric_make),
    fabric_type:            data.fabric_type?.trim().toUpperCase()      || null,
    supplier_material_code: data.supplier_material_code?.trim()         || null,
    internal_material_code: data.internal_material_code?.trim()         || null,
    specifications:         buildSpecifications(data.specifications),
    ply_rating:             data.ply_rating != null ? Number(data.ply_rating) : null,
    active:                 data.active !== false,
    created_at:             existing?.created_at ?? new Date().toISOString(),
    updated_at:             new Date().toISOString(),
  };

  storageSet(`${FABRIC_SUPPLIER_KEY_PREFIX}${id}`, record);
  auditLog({ entity: 'fabric_supplier', entity_id: id, action: isNew ? 'created' : 'edited', diff: record });
  return record;
}

/**
 * Append a specification row. Pass gsm and thickness_mm already resolved
 * from FABRIC_RATE_MASTER for the entry's fabric_type + ply_rating.
 * @param {string} id
 * @param {{ description: string, gsm: number, thickness_mm: number }} spec
 * @returns {object|null} Updated record.
 */
export function addSpecification(id, spec) {
  const record = getFabricSupplier(id);
  if (!record) return null;
  return saveFabricSupplier({
    ...record,
    specifications: [...record.specifications, spec],
  });
}

/**
 * Remove a specification row by index.
 * @param {string} id
 * @param {number} index
 * @returns {object|null} Updated record.
 */
export function removeSpecification(id, index) {
  const record = getFabricSupplier(id);
  if (!record) return null;
  return saveFabricSupplier({
    ...record,
    specifications: record.specifications.filter((_, i) => i !== index),
  });
}

/**
 * Load FABRIC_SUPPLIER_DEFAULTS into localStorage for any entry not already present.
 * Safe to call on every app start — existing records are never overwritten.
 */
export function initFabricSupplierDefaults() {
  const now = new Date().toISOString();
  for (const def of FABRIC_SUPPLIER_DEFAULTS) {
    if (!storageGet(`${FABRIC_SUPPLIER_KEY_PREFIX}${def.id}`)) {
      storageSet(`${FABRIC_SUPPLIER_KEY_PREFIX}${def.id}`, {
        ...def,
        fabric_make:    buildFabricMake(def.fabric_make),
        specifications: buildSpecifications(def.specifications),
        active:         true,
        created_at:     now,
        updated_at:     now,
      });
    }
  }
}

/**
 * Retrieve a single fabric supplier entry by ID.
 * @param {string} id - e.g. 'FSP-0001'
 * @returns {object|null}
 */
export function getFabricSupplier(id) {
  if (!id) return null;
  return storageGet(`${FABRIC_SUPPLIER_KEY_PREFIX}${id}`);
}

/**
 * Retrieve all active entries sorted by supplier_id then ply_rating.
 * @param {boolean} includeInactive
 * @returns {object[]}
 */
export function getAllFabricSuppliers(includeInactive = false) {
  const all = storageGetAll(FABRIC_SUPPLIER_KEY_PREFIX).sort((a, b) =>
    (a.supplier_id ?? '').localeCompare(b.supplier_id ?? '') ||
    (a.ply_rating  ?? 0) - (b.ply_rating  ?? 0)
  );
  return includeInactive ? all : all.filter(s => s.active !== false);
}

/**
 * Return all entries for a specific supplier.
 * @param {string} supplierId - e.g. 'SUP-0001'
 * @returns {object[]}
 */
export function getFabricSuppliersBySupplier(supplierId) {
  return getAllFabricSuppliers().filter(s => s.supplier_id === supplierId);
}

/**
 * Search entries by supplier location, make, short form, fabric type, or material codes
 * (case-insensitive partial match). Returns all when query is blank.
 * @param {string} query
 * @returns {object[]}
 */
export function searchFabricSuppliers(query) {
  if (!query?.trim()) return getAllFabricSuppliers();
  const q = query.toLowerCase();
  return getAllFabricSuppliers().filter(s =>
    s.supplier_id?.toLowerCase().includes(q)               ||
    s.supplier_location?.toLowerCase().includes(q)         ||
    s.fabric_make?.make?.toLowerCase().includes(q)         ||
    s.fabric_make?.short_form?.toLowerCase().includes(q)   ||
    s.fabric_type?.toLowerCase().includes(q)               ||
    s.supplier_material_code?.toLowerCase().includes(q)    ||
    s.internal_material_code?.toLowerCase().includes(q)
  );
}

/**
 * Soft-delete a fabric supplier entry (sets active = false).
 * @param {string} id
 * @returns {object|null} Updated record.
 */
export function deactivateFabricSupplier(id) {
  const record = getFabricSupplier(id);
  if (!record) return null;
  return saveFabricSupplier({ ...record, active: false });
}

/**
 * Check whether an entry with the given ID exists.
 * @param {string} id
 * @returns {boolean}
 */
export function fabricSupplierExists(id) {
  return getFabricSupplier(id) !== null;
}
