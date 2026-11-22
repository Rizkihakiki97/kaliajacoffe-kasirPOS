import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu as MenuIcon, ShoppingBag, UserRound, X } from 'lucide-react';
import BrandMark from './BrandMark';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { ROLE_LABEL } from '../utils/constants';
import { initials } from '../utils/format';
import { Button } from './ui';

const links = [
  { to: '/', label: 'Beranda', end: true },
  { to: '/menu', label: 'Menu' },
  { to: '/activities', label: 'Kegiatan' },
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { count } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const close = () => setOpen(false);

  const handleLogout = async () => {
    await logout();
    close();
    toast.success('Anda telah keluar.');
    navigate('/');
  };

  const dashboardPath = user?.role === 'admin' ? '/admin' : user?.role === 'bos' ? '/bos' : null;

  return (
    <div className="public-shell">
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="site-header__brand" onClick={close}>
            <BrandMark />
          </Link>

          <nav className={`site-nav ${open ? 'site-nav--open' : ''}`}>
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => (isActive ? 'site-nav__link is-active' : 'site-nav__link')}
                onClick={close}
              >
                {link.label}
              </NavLink>
            ))}
            <div className="site-nav__mobile-actions">
              {isAuthenticated ? (
                <>
                  {dashboardPath && <Link to={dashboardPath} className="btn btn--primary btn--sm" onClick={close}>Dashboard</Link>}
                  <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>Keluar</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn btn--ghost btn--sm" onClick={close}>Masuk</Link>
                  <Link to="/register" className="btn btn--primary btn--sm" onClick={close}>Daftar</Link>
                </>
              )}
            </div>
          </nav>

          <div className="site-header__actions">
            {isAuthenticated && user?.role === 'customer' && (
              <Link to="/menu" className="cart-pill" aria-label={`Keranjang, ${count} item`}>
                <ShoppingBag size={18} />
                <span>{count}</span>
              </Link>
            )}
            {isAuthenticated ? (
              <div className="user-chip" title={`${user.name} (${ROLE_LABEL[user.role] || user.role})`}>
                <span className="avatar">{initials(user.name)}</span>
                <span className="user-chip__name">{user.name.split(' ')[0]}</span>
                <button type="button" className="icon-btn icon-btn--small" onClick={handleLogout} aria-label="Keluar">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn btn--ghost btn--sm site-header__login"><UserRound size={16} /> Masuk</Link>
            )}
            <button
              type="button"
              className="icon-btn site-header__toggle"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? 'Tutup menu' : 'Buka menu'}
            >
              {open ? <X size={21} /> : <MenuIcon size={21} />}
            </button>
          </div>
        </div>
      </header>

      <main key={location.pathname} className="public-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div>
            <BrandMark light />
            <p>Tempat ngopi, berkumpul, dan berbagi cerita. Pesan favoritmu kapan saja.</p>
          </div>
          <div className="site-footer__links">
            <div>
              <h4>Jelajahi</h4>
              <Link to="/menu">Daftar Menu</Link>
              <Link to="/activities">Galeri Kegiatan</Link>
            </div>
            <div>
              <h4>Akun</h4>
              <Link to="/login">Masuk</Link>
              <Link to="/register">Daftar</Link>
              <Link to="/forgot-password">Lupa Password</Link>
            </div>
          </div>
        </div>
        <div className="container site-footer__bottom">
          <span>© {new Date().getFullYear()} Kaliaja.coffe. Seluruh hak dilindungi.</span>
        </div>
      </footer>
    </div>
  );
}
