// masters/cover_thickness_master.js
// Source: 02-master-architecture.md
// Standard cover thicknesses for top and bottom cover compounds.
// Both top and bottom cover select independently from this same master.

export const COVER_THICKNESS_MASTER = Object.freeze([
  { id: 'CT-1',    thickness_mm: 1,    display: '1 mm',   active: true },
  { id: 'CT-1.5',  thickness_mm: 1.5,  display: '1.5 mm', active: true },
  { id: 'CT-2',    thickness_mm: 2,    display: '2 mm',   active: true },
  { id: 'CT-2.5',  thickness_mm: 2.5,  display: '2.5 mm', active: true },
  { id: 'CT-3',    thickness_mm: 3,    display: '3 mm',   active: true },
  { id: 'CT-4',    thickness_mm: 4,    display: '4 mm',   active: true },
  { id: 'CT-5',    thickness_mm: 5,    display: '5 mm',   active: true },
  { id: 'CT-6',    thickness_mm: 6,    display: '6 mm',   active: true },
  { id: 'CT-8',    thickness_mm: 8,    display: '8 mm',   active: true },
  { id: 'CT-10',   thickness_mm: 10,   display: '10 mm',  active: true },
  { id: 'CT-12',   thickness_mm: 12,   display: '12 mm',  active: true },
  { id: 'CT-15',   thickness_mm: 15,   display: '15 mm',  active: true },
  { id: 'CT-20',   thickness_mm: 20,   display: '20 mm',  active: true },
]);
