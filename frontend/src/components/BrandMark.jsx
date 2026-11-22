import { useBranding } from '../context/BrandingContext';
import { DEFAULT_LOGO } from '../utils/constants';
import { mediaUrl } from '../utils/format';

export default function BrandMark({ compact = false, light = false }) {
  const { branding } = useBranding();
  const uploadedLogo = mediaUrl(branding.logo_url);
  const logo = uploadedLogo || DEFAULT_LOGO;

  return (
    <span className={`brand-mark ${compact ? 'brand-mark--compact' : ''} ${light ? 'brand-mark--light' : ''}`}>
      <img
        src={logo}
        alt=""
        className={`brand-mark__logo ${uploadedLogo ? '' : 'brand-mark__logo--default'}`.trim()}
      />
      <span className="brand-mark__name">{branding.brand_name || 'Kaliaja.coffe'}</span>
    </span>
  );
}
