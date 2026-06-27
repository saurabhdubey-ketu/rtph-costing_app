// masters/index.js
// Re-exports all master objects for convenient single-import.

export { PRODUCT_MASTER }             from './product_master.js';
export { BELT_TYPE_MASTER }           from './belt_type_master.js';
export {
  BELT_RATING_KEY_PREFIX,
  BELT_RATING_FIELDS,
  BELT_RATING_DEFAULTS,
  saveBeltRating,
  getBeltRating,
  getAllBeltRatings,
  getBeltRatingsByType,
  searchBeltRatings,
  deactivateBeltRating,
  beltRatingExists,
  initBeltRatingDefaults,
}                                     from './belt_rating_master.js';
export { FABRIC_TYPE_MASTER }         from './fabric_type_master.js';
export { FABRIC_STRENGTH_MASTER }     from './fabric_strength_master.js';
export { FABRIC_RATE_MASTER }         from './fabric_rate_master.js';
export {
  FABRIC_SUPPLIER_MASTER,
  FABRIC_SUPPLIER_KEY_PREFIX,
  FABRIC_SUPPLIER_FIELDS,
  FABRIC_SUPPLIER_DEFAULTS,
  saveFabricSupplier,
  getFabricSupplier,
  getAllFabricSuppliers,
  getFabricSuppliersBySupplier,
  searchFabricSuppliers,
  deactivateFabricSupplier,
  fabricSupplierExists,
  initFabricSupplierDefaults,
  addSpecification,
  removeSpecification,
}                                     from './fabric_supplier_master.js';
export { COMPOUND_MASTER, COVER_SKIM_COMPATIBILITY } from './compound_master.js';
export { GRADE_MASTER }               from './grade_master.js';
export { COVER_THICKNESS_MASTER }     from './cover_thickness_master.js';
export { WIDTH_METRIC_RANGE, WIDTH_IMPERIAL, getWidthOptions, findWidth, widthToMm } from './width_master.js';
export { LENGTH_MASTER }              from './length_master.js';
export { EDGE_MASTER }                from './edge_master.js';
export { REEL_PACKING_MASTER }        from './reel_packing_master.js';
export { BREAKER_MASTER }             from './breaker_master.js';
export { FREIGHT_STATE_MASTER }       from './freight_master.js';
export { GP_MASTER }                  from './gp_master.js';
export {
  CUSTOMER_KEY_PREFIX,
  CUSTOMER_FIELDS,
  CUSTOMER_SEED_DATA,
  saveCustomer,
  getCustomer,
  getAllCustomers,
  searchCustomers,
  customerExists,
  resolveCustomerSite,
  disableCustomer,
  enableCustomer,
}                                     from './customer_master.js';
export {
  CURRENCY_KEY_PREFIX,
  CURRENCY_FIELDS,
  CURRENCY_DEFAULTS,
  saveCurrency,
  getCurrency,
  getCurrencyByCode,
  getAllCurrencies,
  deactivateCurrency,
  currencyExists,
  initCurrencyDefaults,
}                                     from './currency_master.js';
export {
  SUPPLIER_KEY_PREFIX,
  SUPPLIER_FIELDS,
  SUPPLIER_CATEGORY_TYPES,
  ADDRESS_CATEGORY_TYPES,
  SUPPLIER_DEFAULTS,
  saveSupplier,
  getSupplier,
  getAllSuppliers,
  searchSuppliers,
  deactivateSupplier,
  supplierExists,
  initSupplierDefaults,
  addSupplierProduct,
  removeSupplierProduct,
}                                     from './supplier_master.js';
