// masters/supplier_master.js
// Supplier data access layer — CRUD for supplier records persisted in localStorage.
// Each supplier is stored under key 'supplier.SUP-NNNN' via lib/storage.js.
// Call initSupplierDefaults() once at app start to pre-load known suppliers.

import { storageGet, storageSet, storageGetAll } from '../lib/storage.js';
import { nextSupplierId } from '../lib/id.js';
import { auditLog } from '../lib/audit.js';

export const SUPPLIER_KEY_PREFIX = 'supplier.';

// Address category — which type of premises this address belongs to.
export const ADDRESS_CATEGORY_TYPES = Object.freeze([
  'head_office',
  'plant',
  'godown',
  'depo',
  'warehouse',
]);

// Supplier business category.
export const SUPPLIER_CATEGORY_TYPES = Object.freeze([
  'manufacturer',
  'dealer_distributor',
]);

// Canonical top-level field list. Nested shapes are documented below.
export const SUPPLIER_FIELDS = Object.freeze([
  'id',            // Auto-generated SUP-NNNN
  'short_form',    // Short code / abbreviation   e.g. MIT, SRF
  'num_code',      // Business numeric code        e.g. 1, 2
  'supplier_name', // Required — company or trade name
  'address',       // Object — see address shape
  'contact_info',  // Object — see contact_info shape
  'category',      // Object — see category shape
  'gst_number',    // GST registration number
  'pan_number',    // PAN number
  'id_proof_1',    // Object { proof_type, attachment }
  'id_proof_2',    // Object { proof_type, attachment }
  'active',        // boolean — soft-delete flag
  'created_at',    // ISO timestamp — set once at creation
  'updated_at',    // ISO timestamp — refreshed on every save
]);

/*
  address shape:
  {
    category:  'head_office' | 'plant' | 'godown' | 'depo' | 'warehouse' | null,
    field_1:   string | null,   // Address line 1
    field_2:   string | null,   // Address line 2
    district:  string | null,
    city:      string | null,
    pin_code:  string | null,
    state:     string | null,
    country:   string | null,
  }

  contact_info shape:
  {
    telephone: string | null,
    mobile:    string | null,
    email_id:  string | null,
    website:   string | null,
  }

  category shape:
  {
    type:     'manufacturer' | 'dealer_distributor' | null,
    products: string[],   // product IDs linked to this supplier; only used when type === 'manufacturer'
                          // managed via addSupplierProduct / removeSupplierProduct
  }

  id_proof_1 / id_proof_2 shape:
  {
    proof_type:  string | null,   // free-text label e.g. 'GST Certificate', 'PAN Card'
    attachment:  string | null,   // base64 data-URL or file reference
  }
*/

// ---------------------------------------------------------------------------
// Default / seed supplier records
// ---------------------------------------------------------------------------
export const SUPPLIER_DEFAULTS = Object.freeze([
  {
    id:            'SUP-0001',
    short_form:    'MIT',
    num_code:      1,
    supplier_name: 'Madura Industrial Textiles Limited',
    address: {
      category:  'plant',
      field_1:   'Dadra Unit',
      field_2:   null,
      district:  null,
      city:      'Dadra',
      pin_code:  null,
      state:     'Dadra and Nagar Haveli',
      country:   'India',
    },
    category: { type: 'manufacturer', products: [] },
  },
  {
    id:            'SUP-0002',
    short_form:    'SRF',
    num_code:      2,
    supplier_name: 'SRF Limited',
    address: {
      category:  'plant',
      field_1:   'Gummidipoondi',
      field_2:   null,
      district:  null,
      city:      'Gummidipoondi',
      pin_code:  null,
      state:     'Tamil Nadu',
      country:   'India',
    },
    category: { type: 'manufacturer', products: [] },
  },
]);

// ---------------------------------------------------------------------------
// Internal builders
// ---------------------------------------------------------------------------

function buildAddress(a = {}) {
  return {
    category: ADDRESS_CATEGORY_TYPES.includes(a.category) ? a.category : null,
    field_1:  a.field_1?.trim()  || null,
    field_2:  a.field_2?.trim()  || null,
    district: a.district?.trim() || null,
    city:     a.city?.trim()     || null,
    pin_code: a.pin_code?.trim() || null,
    state:    a.state?.trim()    || null,
    country:  a.country?.trim()  || null,
  };
}

function buildContactInfo(c = {}) {
  return {
    telephone: c.telephone?.trim() || null,
    mobile:    c.mobile?.trim()    || null,
    email_id:  c.email_id?.trim()  || null,
    website:   c.website?.trim()   || null,
  };
}

function buildCategory(cat = {}) {
  const type = SUPPLIER_CATEGORY_TYPES.includes(cat.type) ? cat.type : null;
  return {
    type,
    products: type === 'manufacturer' ? (Array.isArray(cat.products) ? [...cat.products] : []) : [],
  };
}

function buildIdProof(p = {}) {
  return {
    proof_type: p.proof_type?.trim() || null,
    attachment: p.attachment         || null,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Save a supplier record.
 * Omit `id` to create a new record (ID auto-assigned).
 * Include an existing `id` to update that record.
 * @param {object} data
 * @returns {object} The saved supplier record.
 */
export function saveSupplier(data) {
  const isNew = !data.id;
  const id = isNew ? nextSupplierId() : data.id;
  const existing = isNew ? null : storageGet(`${SUPPLIER_KEY_PREFIX}${id}`);

  const record = {
    id,
    short_form:    (data.short_form ?? '').trim()          || null,
    num_code:      data.num_code != null ? Number(data.num_code) : null,
    supplier_name: (data.supplier_name ?? '').trim(),
    address:       buildAddress(data.address),
    contact_info:  buildContactInfo(data.contact_info),
    category:      buildCategory(data.category),
    gst_number:    data.gst_number?.trim()                 || null,
    pan_number:    data.pan_number?.trim()                 || null,
    id_proof_1:    buildIdProof(data.id_proof_1),
    id_proof_2:    buildIdProof(data.id_proof_2),
    active:        data.active !== false,
    created_at:    existing?.created_at ?? new Date().toISOString(),
    updated_at:    new Date().toISOString(),
  };

  storageSet(`${SUPPLIER_KEY_PREFIX}${id}`, record);
  auditLog({ entity: 'supplier', entity_id: id, action: isNew ? 'created' : 'edited', diff: record });
  return record;
}

/**
 * Load SUPPLIER_DEFAULTS into localStorage for any record not already present.
 * Safe to call on every app start — existing records are never overwritten.
 */
export function initSupplierDefaults() {
  const now = new Date().toISOString();
  for (const def of SUPPLIER_DEFAULTS) {
    if (!storageGet(`${SUPPLIER_KEY_PREFIX}${def.id}`)) {
      storageSet(`${SUPPLIER_KEY_PREFIX}${def.id}`, {
        short_form:    def.short_form    ?? null,
        num_code:      def.num_code      ?? null,
        supplier_name: def.supplier_name,
        address:       buildAddress(def.address),
        contact_info:  buildContactInfo({}),
        category:      buildCategory(def.category ?? {}),
        gst_number:    null,
        pan_number:    null,
        id_proof_1:    buildIdProof({}),
        id_proof_2:    buildIdProof({}),
        active:        true,
        created_at:    now,
        updated_at:    now,
        id:            def.id,
      });
    }
  }
}

/**
 * Add a product ID to a manufacturer supplier's products list.
 * No-op if the supplier is not a manufacturer or product already listed.
 * @param {string} supplierId
 * @param {string} productId
 * @returns {object|null} Updated record.
 */
export function addSupplierProduct(supplierId, productId) {
  const record = getSupplier(supplierId);
  if (!record || record.category?.type !== 'manufacturer') return null;
  if (record.category.products.includes(productId)) return record;
  return saveSupplier({
    ...record,
    category: { ...record.category, products: [...record.category.products, productId] },
  });
}

/**
 * Remove a product ID from a manufacturer supplier's products list.
 * @param {string} supplierId
 * @param {string} productId
 * @returns {object|null} Updated record.
 */
export function removeSupplierProduct(supplierId, productId) {
  const record = getSupplier(supplierId);
  if (!record || record.category?.type !== 'manufacturer') return null;
  return saveSupplier({
    ...record,
    category: { ...record.category, products: record.category.products.filter(p => p !== productId) },
  });
}

/**
 * Retrieve a single supplier by ID.
 * @param {string} id - e.g. 'SUP-0001'
 * @returns {object|null}
 */
export function getSupplier(id) {
  if (!id) return null;
  return storageGet(`${SUPPLIER_KEY_PREFIX}${id}`);
}

/**
 * Retrieve all active suppliers sorted by num_code, then ID.
 * @param {boolean} includeInactive - pass true to include soft-deleted records
 * @returns {object[]}
 */
export function getAllSuppliers(includeInactive = false) {
  const all = storageGetAll(SUPPLIER_KEY_PREFIX).sort((a, b) =>
    (a.num_code ?? 9999) - (b.num_code ?? 9999) || a.id.localeCompare(b.id)
  );
  return includeInactive ? all : all.filter(s => s.active !== false);
}

/**
 * Search suppliers by name, short form, city, state, email, or GST number
 * (case-insensitive partial match). Returns all suppliers when query is blank.
 * @param {string} query
 * @returns {object[]}
 */
export function searchSuppliers(query) {
  if (!query?.trim()) return getAllSuppliers();
  const q = query.toLowerCase();
  return getAllSuppliers().filter(s =>
    s.supplier_name?.toLowerCase().includes(q)          ||
    s.short_form?.toLowerCase().includes(q)             ||
    s.address?.city?.toLowerCase().includes(q)          ||
    s.address?.state?.toLowerCase().includes(q)         ||
    s.contact_info?.email_id?.toLowerCase().includes(q) ||
    s.gst_number?.toLowerCase().includes(q)
  );
}

/**
 * Soft-delete a supplier (sets active = false).
 * @param {string} id
 * @returns {object|null} Updated record, or null if not found.
 */
export function deactivateSupplier(id) {
  const record = getSupplier(id);
  if (!record) return null;
  return saveSupplier({ ...record, active: false });
}

/**
 * Check whether a supplier with the given ID exists.
 * @param {string} id
 * @returns {boolean}
 */
export function supplierExists(id) {
  return getSupplier(id) !== null;
}
