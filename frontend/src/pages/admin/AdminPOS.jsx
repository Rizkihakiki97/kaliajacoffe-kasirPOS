import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { Badge, Button, Card, EmptyState, Field, ImageThumb, Input, PageHeader, SearchInput, Spinner } from '../../components/ui';
import { useCategories } from '../../context/CategoriesContext';
import { useToast } from '../../context/ToastContext';
import { LOW_STOCK_LIMIT } from '../../utils/constants';
import { errorMessage, rupiah } from '../../utils/format';

export default function AdminPOS() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();
  const { categories } = useCategories();

  useEffect(() => {
    const controller = new AbortController();
    api.products
      .list(undefined, controller.signal)
      .then((data) => setProducts(data || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchCategory = category === 'all' || product.category_name === categories.find((item) => item.slug === category)?.name;
      return matchCategory && (!needle || product.name.toLowerCase().includes(needle));
    });
  }, [products, query, category, categories]);

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const addToCart = (product) => {
    if (product.stock <= 0) return;
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item);
      }
      return [...current, { id: product.id, name: product.name, price: Number(product.price), stock: product.stock, quantity: 1 }];
    });
  };

  const updateQuantity = (id, quantity) => {
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.min(Math.max(quantity, 1), item.stock) } : item));
  };

  const handleCheckout = async () => {
    if (!cart.length) return;
    setSubmitting(true);
    try {
      const payload = {
        items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      };
      const parsedCustomerId = Number(customerId);
      if (Number.isInteger(parsedCustomerId) && parsedCustomerId > 0) payload.customer_id = parsedCustomerId;
      const data = await api.transactions.pos(payload);
      setResult(data);
      setCart([]);
      setCustomerId('');
      toast.success('Transaksi kasir berhasil.');
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal memproses transaksi.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <>
        <PageHeader title="Transaksi Berhasil" description="Struk bisa diunggah langsung dari halaman transaksi." />
        <Card className="success-panel success-panel--inline">
          <div className="success-panel__icon"><CheckCircle2 size={36} /></div>
          <h2>{result.invoice_code}</h2>
          <p>Total transaksi: <strong>{rupiah(result.total_amount)}</strong></p>
          <div className="success-panel__actions">
            <Button icon={ArrowRight} onClick={() => navigate(`/admin/transactions?tx=${result.id}`)}>Unggah Struk</Button>
            <Button variant="outline" onClick={() => setResult(null)}>Transaksi Baru</Button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Kasir (POS)" description="Pilih menu, hitung total otomatis, dan simpan transaksi." />

      <div className="pos-layout">
        <Card className="panel">
          <div className="panel__toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Cari menu..." />
            <select className="input select select--compact" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">Semua kategori</option>
              {categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </div>

          {loading ? (
            <Spinner label="Memuat menu..." />
          ) : filtered.length ? (
            <div className="pos-product-grid">
              {filtered.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  className="pos-product"
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                >
                  <ImageThumb src={product.image_url} alt={product.name} className="pos-product__image" />
                  <span className="pos-product__info">
                    <strong>{product.name}</strong>
                    <small>{rupiah(product.price)}</small>
                    <Badge tone={product.stock <= LOW_STOCK_LIMIT ? 'danger' : 'success'}>Stok {product.stock}</Badge>
                  </span>
                  <Plus size={17} className="pos-product__plus" />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="Menu tidak tersedia" description="Tambahkan produk terlebih dahulu." />
          )}
        </Card>

        <Card className="panel pos-cart">
          <div className="panel__header"><h2><ShoppingCart size={18} /> Keranjang ({cartCount})</h2></div>

          {cart.length ? (
            <div className="pos-cart__list">
              {cart.map((item) => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item__body">
                    <strong>{item.name}</strong>
                    <span>{rupiah(item.price)}</span>
                    <div className="qty-control">
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="Kurangi"><Minus size={14} /></button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.stock} aria-label="Tambah"><Plus size={14} /></button>
                    </div>
                  </div>
                  <button type="button" className="icon-btn icon-btn--small" onClick={() => setCart((current) => current.filter((row) => row.id !== item.id))} aria-label="Hapus item"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted pos-cart__empty">Klik menu di sebelah kiri untuk menambah item.</p>
          )}

          <div className="pos-cart__summary">
            <Field label="ID Customer (opsional)" hint="Kosongkan untuk transaksi walk-in.">
              <Input type="number" min="1" value={customerId} onChange={(event) => setCustomerId(event.target.value)} placeholder="Contoh: 3" />
            </Field>
            <div className="pos-cart__total"><span>Total</span><strong>{rupiah(total)}</strong></div>
            <Button size="lg" loading={submitting} disabled={!cart.length} onClick={handleCheckout} className="pos-cart__submit" icon={CheckCircle2}>
              Proses Transaksi
            </Button>
            <p className="muted">Stok berkurang otomatis setelah transaksi dibuat.</p>
          </div>
        </Card>
      </div>
    </>
  );
}
