import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  Package,
  Palette,
  ReceiptText,
  ShoppingCart,
  X,
} from 'lucide-react';
import BrandMark from './BrandMark';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLE_LABEL } from '../utils/constants';
import { initials } from '../utils/format';

const ADMIN_NAV = [
  { to: '/admin', label: 'Ringkasan', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Produk', icon: Package },
  { to: '/admin/activities', label: 'Kegiatan', icon: CalendarDays },
  { to: '/admin/pos', label: 'Kasir (POS)', icon: ShoppingCart },
  { to: '/admin/transactions', label: 'Transaksi & Struk', icon: ReceiptText },
];

const BOS_NAV = [
  { to: '/bos', label: 'Ringkasan', icon: LayoutDashboard, end: true },
  { to: '/bos/branding', label: 'Logo & Favicon', icon: Palette },
];

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const nav = isAdmin ? ADMIN_NAV : BOS_NAV;
  const base = isAdmin ? '/admin' : '/bos';

  const handleLogout = async () => {
    await logout();
    toast.success('Anda telah keluar.');
    navigate('/login');
  };

  return (
    <div className="dashboard-shell">
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__top">
          <Link to={base} className="sidebar__brand" onClick={() => setOpen(false)}>
            <BrandMark light compact />
          </Link>
          <button type="button" className="icon-btn sidebar__close" onClick={() => setOpen(false)} aria-label="Tutup sidebar">
            <X size={20} />
          </button>
        </div>
        <div className="sidebar__role">{ROLE_LABEL[user?.role] || 'Pengguna'} · Panel</div>
        <nav className="sidebar__nav">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? 'sidebar__link is-active' : 'sidebar__link')}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__bottom">
          <Link to="/" className="sidebar__link" onClick={() => setOpen(false)}>
            <ExternalLink size={18} />
            <span>Lihat Website</span>
          </Link>
          <button type="button" className="sidebar__link" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {open && <button type="button" className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Tutup sidebar" />}

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <button type="button" className="icon-btn dashboard-topbar__toggle" onClick={() => setOpen(true)} aria-label="Buka sidebar">
            <MenuIcon size={21} />
          </button>
          <div className="dashboard-topbar__spacer" />
          <div className="dashboard-topbar__user">
            <span className="avatar">{initials(user?.name || '')}</span>
            <div>
              <strong>{user?.name || 'Pengguna'}</strong>
              <small>{user?.email || ''}</small>
            </div>
          </div>
          <span className="badge badge--primary">{ROLE_LABEL[user?.role] || user?.role}</span>
        </header>
        <div className="dashboard-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
