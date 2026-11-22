import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="container page-pad">
      <div className="empty-state empty-state--tall">
        <div className="empty-state__icon"><Compass size={28} /></div>
        <h1>404 — Halaman tidak ditemukan</h1>
        <p>Alamat yang kamu buka tidak tersedia.</p>
        <Link to="/" className="btn btn--primary">Kembali ke beranda</Link>
      </div>
    </div>
  );
}
