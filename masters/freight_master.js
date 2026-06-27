// masters/freight_state_master.js
// Source: legacy HRS Mastersheet freight column, repaired as per Jitesh's decisions.
// Rate is ₹ per kg of belt weight (interpretation per legacy convention — confirm unit at calc-engine wiring).
// rate_status: 'active' = use as-is; 'pending' = rate is 0.00 because business has not provided data;
//   calc engine MUST surface a warning when a quote is built against a 'pending' destination
//   rather than silently applying ₹0 freight.
// HY (Hyderabad) retained as a separate destination from TS (Telangana) per locked decision.

export const FREIGHT_STATE_MASTER = Object.freeze([
  { id: 'FRT-ST-AP', code: 'AP', state_name: 'Andhra Pradesh', rate_per_kg: 6.55, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-HY', code: 'HY', state_name: 'Hyderabad', rate_per_kg: 6.55, rate_status: 'active', note: 'Legacy code retained per Jitesh decision; separate from Telangana', active: true },
  { id: 'FRT-ST-AS', code: 'AS', state_name: 'Assam', rate_per_kg: 14.77, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-BR', code: 'BR', state_name: 'Bihar', rate_per_kg: 9.89, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-CG', code: 'CG', state_name: 'Chhattisgarh', rate_per_kg: 6.29, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-GA', code: 'GA', state_name: 'Goa', rate_per_kg: 5.78, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-GJ', code: 'GJ', state_name: 'Gujarat', rate_per_kg: 3.21, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-HR', code: 'HR', state_name: 'Haryana', rate_per_kg: 6.03, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-HP', code: 'HP', state_name: 'Himachal Pradesh', rate_per_kg: 7.06, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-JK', code: 'JK', state_name: 'Jammu and Kashmir', rate_per_kg: 11.24, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-JH', code: 'JH', state_name: 'Jharkhand', rate_per_kg: 9.37, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-KA', code: 'KA', state_name: 'Karnataka', rate_per_kg: 6.16, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-KL', code: 'KL', state_name: 'Kerala', rate_per_kg: 7.96, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-MP', code: 'MP', state_name: 'Madhya Pradesh', rate_per_kg: 5.46, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-MH', code: 'MH', state_name: 'Maharashtra', rate_per_kg: 4.82, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-MN', code: 'MN', state_name: 'Manipur', rate_per_kg: 0.00, rate_status: 'pending', note: 'Rate pending — verify with business before quoting', active: true },
  { id: 'FRT-ST-ML', code: 'ML', state_name: 'Meghalaya', rate_per_kg: 12.84, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-MZ', code: 'MZ', state_name: 'Mizoram', rate_per_kg: 0.00, rate_status: 'pending', note: 'Rate pending — verify with business before quoting', active: true },
  { id: 'FRT-ST-NL', code: 'NL', state_name: 'Nagaland', rate_per_kg: 0.00, rate_status: 'pending', note: 'Rate pending — verify with business before quoting', active: true },
  { id: 'FRT-ST-OR', code: 'OR', state_name: 'Orissa', rate_per_kg: 8.60, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-PB', code: 'PB', state_name: 'Punjab', rate_per_kg: 6.68, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-RJ', code: 'RJ', state_name: 'Rajasthan', rate_per_kg: 4.88, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-SK', code: 'SK', state_name: 'Sikkim', rate_per_kg: 0.00, rate_status: 'pending', note: 'Rate pending — verify with business before quoting', active: true },
  { id: 'FRT-ST-TN', code: 'TN', state_name: 'Tamil Nadu', rate_per_kg: 7.32, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-TR', code: 'TR', state_name: 'Tripura', rate_per_kg: 4.28, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-UK', code: 'UK', state_name: 'Uttarakhand', rate_per_kg: 7.45, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-UP', code: 'UP', state_name: 'Uttar Pradesh', rate_per_kg: 7.45, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-WB', code: 'WB', state_name: 'West Bengal', rate_per_kg: 9.89, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-AN', code: 'AN', state_name: 'Andaman and Nicobar Islands', rate_per_kg: 0.00, rate_status: 'pending', note: 'Rate pending — verify with business before quoting', active: true },
  { id: 'FRT-ST-CH', code: 'CH', state_name: 'Chandigarh', rate_per_kg: 5.89, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-DH', code: 'DH', state_name: 'Dadra and Nagar Haveli', rate_per_kg: 0.00, rate_status: 'pending', note: 'Rate pending — verify with business before quoting', active: true },
  { id: 'FRT-ST-DD', code: 'DD', state_name: 'Daman and Diu', rate_per_kg: 7.50, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-DL', code: 'DL', state_name: 'Delhi', rate_per_kg: 5.52, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-LD', code: 'LD', state_name: 'Lakshadweep', rate_per_kg: 5.35, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-PY', code: 'PY', state_name: 'Pondicherry', rate_per_kg: 5.78, rate_status: 'active', note: null, active: true },
  { id: 'FRT-ST-TS', code: 'TS', state_name: 'Telangana', rate_per_kg: 4.80, rate_status: 'active', note: null, active: true },
]);