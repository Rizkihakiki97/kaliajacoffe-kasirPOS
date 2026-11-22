import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { mediaUrl } from '../utils/format';

const BrandingContext = createContext(null);

const DEFAULT_BRANDING = {
  brand_name: 'Kaliaja.coffe',
  logo_url: '',
  favicon_url: '',
};

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  const refreshBranding = useCallback(async (signal) => {
    try {
      const data = await api.branding.get(signal);
      setBranding((current) => ({ ...current, ...data }));
    } catch {
      // Branding opsional: pakai identitas default bila backend belum tersedia.
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refreshBranding(controller.signal);
    return () => controller.abort();
  }, [refreshBranding]);

  useEffect(() => {
    if (branding.brand_name) document.title = `${branding.brand_name} — POS & Pemesanan Kafe`;
    const favicon = mediaUrl(branding.favicon_url || branding.logo_url);
    if (!favicon) return;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = favicon;
  }, [branding]);

  const value = useMemo(() => ({ branding, refreshBranding }), [branding, refreshBranding]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) throw new Error('useBranding harus dipakai di dalam BrandingProvider');
  return context;
}
