// lib/formatter.js
// Display formatting utilities.
// ₹ amounts use Indian locale with commas. Dates use dd-mmm-yyyy.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Format a number as Indian Rupees (₹1,23,456.78).
 * @param {number} value
 * @param {number} [decimals=2]
 * @returns {string}
 */
export function formatRupees(value, decimals = 2) {
  if (value == null || isNaN(value)) return '—';
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Format a weight in kg with 2 decimal places.
 * @param {number} value
 * @returns {string}
 */
export function formatKg(value) {
  if (value == null || isNaN(value)) return '—';
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
}

/**
 * Format a date as dd-mmm-yyyy (e.g. 09-Jun-2026).
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = MONTHS[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${dd}-${mmm}-${yyyy}`;
}

/**
 * Format today's date as dd-mmm-yyyy.
 * @returns {string}
 */
export function today() {
  return formatDate(new Date());
}

/**
 * Format a percentage (0.35 → '35.0%').
 * @param {number} fraction
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatPct(fraction, decimals = 1) {
  if (fraction == null || isNaN(fraction)) return '—';
  return (fraction * 100).toFixed(decimals) + '%';
}

/**
 * Format a dimension as mm or inches depending on unit_type.
 * @param {number} value
 * @param {string} unit_type - 'metric' | 'imperial'
 * @returns {string}
 */
export function formatDimension(value, unit_type) {
  return unit_type === 'imperial' ? `${value}"` : `${value} mm`;
}
