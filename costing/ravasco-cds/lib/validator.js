// lib/validator.js
// Field-level validation. One validate(field, value, context) function.
// Rules keyed by field name. Returns { valid: boolean, message: string }.
// Source: Developer Prompt §11.

import { getWidthOptions, WIDTH_IMPERIAL } from '../masters/width_master.js';
import { COVER_THICKNESS_MASTER } from '../masters/cover_thickness_master.js';
import { GP_MASTER }              from '../masters/gp_master.js';

const RULES = {
  width_id(value) {
    if (!value) return 'Width is required.';
    const allWidths = [...getWidthOptions(), ...WIDTH_IMPERIAL];
    const found = allWidths.find(r => r.id === value) || String(value).startsWith('CUSTOM-');
    if (!found) return 'Width must be selected from the master list.';
    return null;
  },

  top_cover_thickness_mm(value) {
    if (value == null || value === '') return 'Top cover thickness is required.';
    const n = Number(value);
    if (isNaN(n) || n <= 0) return 'Top cover thickness must be greater than 0.';
    const found = COVER_THICKNESS_MASTER.find(r => r.thickness_mm === n);
    if (!found) return 'Top cover thickness must be selected from the master list.';
    return null;
  },

  bottom_cover_thickness_mm(value) {
    if (value == null || value === '') return 'Bottom cover thickness is required.';
    const n = Number(value);
    if (isNaN(n) || n <= 0) return 'Bottom cover thickness must be greater than 0.';
    const found = COVER_THICKNESS_MASTER.find(r => r.thickness_mm === n);
    if (!found) return 'Bottom cover thickness must be selected from the master list.';
    return null;
  },

  plies(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 8) return 'Plies must be an integer between 1 and 8.';
    return null;
  },

  length_per_roll_m(value) {
    const n = Number(value);
    if (isNaN(n) || n <= 0) return 'Length per roll must be greater than 0.';
    if (n > 500) return 'Warning: length per roll exceeds 500 m for open-end belt.';
    return null;
  },

  no_of_rolls(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) return 'Number of rolls must be a positive integer.';
    return null;
  },

  sg_top_override(value, context) {
    if (value === null || value === '') return null; // optional
    const n = Number(value);
    const bounds = GP_MASTER.override_bounds.sg_top;
    if (isNaN(n) || n <= 0) return 'SG override must be a positive number.';
    if (n < bounds.min || n > bounds.max) return `SG override must be between ${bounds.min} and ${bounds.max}.`;
    return null;
  },

  sg_bottom_override(value) {
    if (value === null || value === '') return null;
    const n = Number(value);
    const bounds = GP_MASTER.override_bounds.sg_bottom;
    if (isNaN(n) || n <= 0) return 'SG override must be a positive number.';
    if (n < bounds.min || n > bounds.max) return `SG override must be between ${bounds.min} and ${bounds.max}.`;
    return null;
  },

  cover_rate_top_override(value) {
    if (value === null || value === '') return null;
    const n = Number(value);
    const bounds = GP_MASTER.override_bounds.cover_rate_top;
    if (isNaN(n) || n <= 0) return 'Rate override must be a positive number.';
    if (n > bounds.max) return `Rate override must not exceed ₹${bounds.max}/kg.`;
    return null;
  },

  cover_rate_bottom_override(value) {
    if (value === null || value === '') return null;
    const n = Number(value);
    const bounds = GP_MASTER.override_bounds.cover_rate_bottom;
    if (isNaN(n) || n <= 0) return 'Rate override must be a positive number.';
    if (n > bounds.max) return `Rate override must not exceed ₹${bounds.max}/kg.`;
    return null;
  },
};

/**
 * Validate a single field.
 * @param {string} field - Field name matching a key in RULES.
 * @param {*} value
 * @param {object} [context] - Optional context (other form values).
 * @returns {{ valid: boolean, message: string|null }}
 */
export function validate(field, value, context = {}) {
  const rule = RULES[field];
  if (!rule) return { valid: true, message: null };
  const message = rule(value, context);
  return { valid: message === null, message };
}

/**
 * Validate all fields in a form data object.
 * @param {object} data - Field→value map.
 * @param {object} [context]
 * @returns {{ valid: boolean, errors: object }} errors is field→message map.
 */
export function validateAll(data, context = {}) {
  const errors = {};
  for (const [field, value] of Object.entries(data)) {
    const { valid, message } = validate(field, value, context);
    if (!valid) errors[field] = message;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
