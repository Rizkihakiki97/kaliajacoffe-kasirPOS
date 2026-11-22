import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { CATEGORIES } from '../utils/constants';

const CategoriesContext = createContext(null);

// Kategori diambil dari backend agar form produk & filter menu mengikuti data DB.
// Seed db/schema.sql dipakai sebagai fallback saat API belum tersedia.
export function CategoriesProvider({ children }) {
  const [categories, setCategories] = useState(CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    api.categories
      .list(controller.signal)
      .then((data) => {
        if (Array.isArray(data) && data.length) setCategories(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const value = useMemo(() => ({ categories, loading }), [categories, loading]);
  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories() {
  const context = useContext(CategoriesContext);
  if (!context) throw new Error('useCategories harus dipakai di dalam CategoriesProvider');
  return context;
}
