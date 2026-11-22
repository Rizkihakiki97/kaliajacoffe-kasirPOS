import { useEffect, useState } from 'react';
import { Image as ImageIcon, Save } from 'lucide-react';
import api from '../../api/client';
import { Button, Card, Field, ImageThumb, Input, PageHeader, Spinner } from '../../components/ui';
import { useBranding } from '../../context/BrandingContext';
import { useToast } from '../../context/ToastContext';
import { DEFAULT_FAVICON, DEFAULT_LOGO } from '../../utils/constants';
import { errorMessage, mediaUrl } from '../../utils/format';

export default function BosBranding() {
  const { branding, refreshBranding } = useBranding();
  const [form, setForm] = useState({ brand_name: branding.brand_name || '', logo: null, favicon: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => { setForm((current) => ({ ...current, brand_name: branding.brand_name || '' })); }, [branding.brand_name]);

  useEffect(() => {
    const controller = new AbortController();
    api.branding.get(controller.signal)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = new FormData();
      data.append('brand_name', form.brand_name.trim());
      if (form.logo) data.append('logo', form.logo);
      if (form.favicon) data.append('favicon', form.favicon);
      const result = await api.branding.update(data);
      await refreshBranding();
      setForm((current) => ({ ...current, logo: null, favicon: null, brand_name: result.brand_name || current.brand_name }));
      toast.success('Branding diperbarui. Logo dan favicon langsung diterapkan.');
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal menyimpan branding.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Logo & Favicon" description="Atur identitas visual yang tampil di landing page, dashboard, dan tab browser." />

      {loading ? <Spinner label="Memuat branding..." /> : (
        <div className="branding-layout">
          <Card className="panel">
            <form onSubmit={handleSubmit} className="form-stack">
              <Field label="Nama Brand" required>
                <Input value={form.brand_name} onChange={(event) => setForm({ ...form, brand_name: event.target.value })} required maxLength={100} />
              </Field>
              <Field label="Logo Utama" hint="JPG, PNG, GIF, atau WEBP · maks. 5 MB. Favicon akan mengikuti logo bila tidak diunggah terpisah.">
                <Input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event) => setForm({ ...form, logo: event.target.files?.[0] || null })} />
              </Field>
              <Field label="Favicon (opsional)" hint="Format yang sama dengan logo.">
                <Input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event) => setForm({ ...form, favicon: event.target.files?.[0] || null })} />
              </Field>
              <Button type="submit" icon={Save} loading={saving} size="lg">Simpan Branding</Button>
            </form>
          </Card>

          <Card className="panel">
            <div className="panel__header"><h2>Pratinjau</h2></div>
            <div className="branding-preview">
              <div className="branding-preview__item">
                <span>Logo saat ini</span>
                {branding.logo_url ? (
                  <ImageThumb src={branding.logo_url} alt="Logo Kaliaja.coffe" className="branding-preview__logo" />
                ) : (
                  <img src={DEFAULT_LOGO} alt="Logo Kaliaja.coffe" className="branding-preview__static branding-preview__logo" />
                )}
                <small>{branding.logo_url ? mediaUrl(branding.logo_url).split('/').pop() : 'Logo kopi default (dari public/images)'}</small>
              </div>
              <div className="branding-preview__item">
                <span>Favicon saat ini</span>
                {branding.favicon_url ? (
                  <ImageThumb src={branding.favicon_url} alt="Favicon Kaliaja.coffe" className="branding-preview__favicon" />
                ) : (
                  <img src={DEFAULT_FAVICON} alt="Favicon Kaliaja.coffe" className="branding-preview__static branding-preview__favicon" />
                )}
                <small>{branding.favicon_url ? mediaUrl(branding.favicon_url).split('/').pop() : 'Favicon default (dari public/favicon.png)'}</small>
              </div>
            </div>
            <p className="muted"><ImageIcon size={14} /> Perubahan langsung diterapkan ke judul halaman dan favicon setelah disimpan.</p>
          </Card>
        </div>
      )}
    </>
  );
}
