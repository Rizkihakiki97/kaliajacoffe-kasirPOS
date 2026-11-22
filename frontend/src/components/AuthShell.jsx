import { Link } from 'react-router-dom';
import { Coffee, Sparkles } from 'lucide-react';
import BrandMark from './BrandMark';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-page__panel">
        <Link to="/" className="auth-page__brand"><BrandMark light /></Link>
        <div className="auth-page__promo">
          <span className="eyebrow"><Sparkles size={15} /> Kaliaja.coffe</span>
          <h2>Racikan terbaik,<br />dalam satu tempat.</h2>
          <p>Kelola pesanan, stok, dan transaksi kafe dengan lebih mudah — mulai dari secangkir kopi.</p>
          <div className="auth-page__art"><Coffee size={64} strokeWidth={1.4} /></div>
        </div>
        <div className="auth-page__panel-footer">© {new Date().getFullYear()} Kaliaja.coffe</div>
      </div>

      <div className="auth-page__form-side">
        <div className="auth-card">
          <h1>{title}</h1>
          {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}
          {children}
          {footer && <div className="auth-card__footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
