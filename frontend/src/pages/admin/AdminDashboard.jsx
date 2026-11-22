import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarDays, Package, ReceiptText, ShoppingCart, Wallet } from 'lucide-react';
import api from '../../api/client';
import { Badge, Card, ImageThumb, PageHeader, Spinner, StatCard } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { LOW_STOCK_LIMIT } from '../../utils/constants';
import { rupiah } from '../../utils/format';

const quickLinks = [
  { to: '/admin/products', label: 'Kelola Produk', desc: 'Menu, harga, stok, dan foto', icon: Package },
  { to: '/admin/pos', label: 'Buka Kasir', desc: 'Proses transaksi langsung', icon: ShoppingCart },
  { to: '/admin/activities', label: 'Kegiatan', desc: 'Upload foto terbaru', icon: CalendarDays },
  { to: '/admin/transactions', label: 'Transaksi & Struk', desc: 'Kelola bukti pembayaran', icon: ReceiptText },
];

export default function AdminDashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const controller = new AbortController();
    api.products
      .list(undefined, controller.signal)
      .then((data) => setProducts(data || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    const totalStock = products.reduce((sum, item) => sum + item.stock, 0);
    const stockValue = products.reduce((sum, item) => sum + item.stock * item.price, 0);
    return {
      totalProducts: products.length,
      totalStock,
      stockValue,
      lowStock: products.filter((item) => item.stock <= LOW_STOCK_LIMIT),
    };
  }, [products]);

  return (
    <>
      <PageHeader
        title={`Halo, ${user?.name?.split(' ')[0] || 'Admin'} 👋`}
        description="Ringkasan katalog dan stok Kaliaja.coffe hari ini."
        actions={<Link to="/admin/pos" className="btn btn--primary"><ShoppingCart size={17} /> Buka Kasir</Link>}
      />

      {loading ? (
        <Spinner label="Memuat ringkasan..." />
      ) : (
        <>
          <div className="stats-grid">
            <StatCard label="Total Produk" value={stats.totalProducts} hint="Seluruh menu aktif" icon={Package} />
            <StatCard label="Total Stok" value={stats.totalStock} hint="Across all products" icon={Wallet} tone="accent" />
            <StatCard label="Nilai Stok" value={rupiah(stats.stockValue)} hint="Estimasi berdasarkan harga" icon={Wallet} tone="green" />
            <StatCard label="Stok Menipis" value={stats.lowStock.length} hint={`≤ ${LOW_STOCK_LIMIT} pcs`} icon={AlertTriangle} tone="danger" />
          </div>

          <div className="dashboard-grid">
            <Card className="panel">
              <div className="panel__header">
                <h2>Produk stok menipis</h2>
                <Link to="/admin/products" className="text-link">Kelola stok <ArrowRight size={15} /></Link>
              </div>
              {stats.lowStock.length ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th></tr></thead>
                    <tbody>
                      {stats.lowStock.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <div className="cell-with-image">
                              <ImageThumb src={product.image_url} alt={product.name} />
                              <strong>{product.name}</strong>
                            </div>
                          </td>
                          <td>{product.category_name}</td>
                          <td>{rupiah(product.price)}</td>
                          <td><Badge tone="danger">{product.stock}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">Semua produk memiliki stok yang cukup.</p>
              )}
            </Card>

            <Card className="panel">
              <div className="panel__header"><h2>Akses cepat</h2></div>
              <div className="quick-links">
                {quickLinks.map(({ to, label, desc, icon: Icon }) => (
                  <Link key={to} to={to} className="quick-link">
                    <span className="quick-link__icon"><Icon size={19} /></span>
                    <span><strong>{label}</strong><small>{desc}</small></span>
                    <ArrowRight size={16} />
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
