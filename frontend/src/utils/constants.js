// Aset logo kopi milik Kaliaja.coffe (frontend/public/images/logo-kopi-kaliaja.png).
// Versi 128px & favicon 64px dibuat dari file asli agar ringan di navbar/tab.
export const DEFAULT_LOGO = '/images/logo-kopi-kaliaja-128.png';
export const DEFAULT_FAVICON = '/favicon.png';

// Fallback kategori saat GET /api/categories belum tersedia (seed db/schema.sql).
export const CATEGORIES = [
  { id: 1, name: 'Coffee', slug: 'coffee' },
  { id: 2, name: 'Non-Coffee', slug: 'non-coffee' },
  { id: 3, name: 'Snack', slug: 'snack' },
];

export const ROLE_LABEL = {
  customer: 'Customer',
  admin: 'Admin',
  bos: 'BOS',
};

export const LOW_STOCK_LIMIT = 5;
