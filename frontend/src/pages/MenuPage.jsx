import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Minus, Plus, Printer, ShoppingBag, ShoppingCart, Trash2, X } from 'lucide-react';
import api from '../api/client';
import { Badge, Button, EmptyState, ImageThumb, PageHeader, SearchInput, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useCategories } from '../context/CategoriesContext';
import { useToast } from '../context/ToastContext';
import { LOW_STOCK_LIMIT } from '../utils/constants';
import { formatDateTime, rupiah } from '../utils/format';

export default function MenuPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const { user, isAuthenticated } = useAuth();
  const { items, count, total, addItem, updateQuantity, removeItem, clear } = useCart();
  const { categories } = useCategories();
  const toast = useToast();
  const navigate = useNavigate();

  const loadProducts = useCallback(async (signal) => {
    setLoading(true);
    try {
      const data = await api.products.list(undefined, signal);
      setProducts(data || []);
    } catch {
      setProducts([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadProducts(controller.signal);
    return () => controller.abort();
  }, [loadProducts]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchCategory = category === 'all' || product.category_name === categories.find((item) => item.slug === category)?.name;
      const matchQuery = !needle || product.name.toLowerCase().includes(needle) || (product.description || '').toLowerCase().includes(needle);
      return matchCategory && matchQuery;
    });
  }, [products, category, query, categories]);

  const handleOrder = async () => {
    if (!items.length) return;
    if (!isAuthenticated) {
      toast.info('Silakan masuk sebagai customer untuk melanjutkan pesanan.');
      navigate('/login', { state: { from: '/menu' } });
      return;
    }
    if (user?.role !== 'customer') {
      toast.error('Pemesanan hanya untuk akun customer.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.transactions.order({
        items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
      });
      // Simpan detail struk sebelum keranjang dikosongkan. Nama produk diambil
      // dari keranjang karena response API hanya membawa product_id.
      setReceiptItems(
        (result.items || []).map((row) => {
          const cartItem = items.find((item) => item.productId === row.product_id);
          return {
            name: cartItem?.name || `Produk #${row.product_id}`,
            quantity: row.quantity,
            subtotal: row.subtotal,
          };
        })
      );
      clear();
      setCartOpen(false);
      setOrderResult(result);
      toast.success('Pesanan berhasil dibuat.');
      loadProducts();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (orderResult) {
    return (
      <div className="container page-pad">
        <div className="success-panel">
          <div className="success-panel__icon no-print"><CheckCircle2 size={38} /></div>
          <span className="eyebrow eyebrow--dark no-print">Pesanan berhasil</span>
          <h1 className="no-print">Terima kasih, {user?.name?.split(' ')[0] || 'pelanggan'}!</h1>
          <p className="no-print">Pesananmu sudah tercatat. Tunjukkan nomor invoice berikut saat pengambilan.</p>

          <div className="print-receipt" id="print-receipt">
            <div className="print-receipt__head">
              <strong>Kaliaja.coffe</strong>
              <span>Bukti Pesanan</span>
            </div>
            <div className="success-panel__detail">
              <div><span>No. Invoice</span><strong>{orderResult.invoice_code}</strong></div>
              <div><span>Waktu</span><strong>{formatDateTime(orderResult.created_at)}</strong></div>
              <div><span>Status</span><strong className="success-panel__status">{orderResult.status}</strong></div>
            </div>
            <div className="print-receipt__items">
              {receiptItems.map((item, index) => (
                <div key={`${item.name}-${index}`} className="print-receipt__row">
                  <span>{item.quantity}× {item.name}</span>
                  <strong>{rupiah(item.subtotal)}</strong>
                </div>
              ))}
            </div>
            <div className="print-receipt__total">
              <span>Total</span><strong>{rupiah(orderResult.total_amount)}</strong>
            </div>
            <p className="print-receipt__note">Terima kasih telah memesan di Kaliaja.coffe.</p>
          </div>

          <div className="success-panel__actions no-print">
            <Button variant="primary" icon={Printer} onClick={() => window.print()}>Cetak Struk</Button>
            <Button variant="outline" onClick={() => setOrderResult(null)}>Pesan Lagi</Button>
            <Link to="/" className="btn btn--ghost">Kembali ke Beranda</Link>
          </div>
          <p className="footnote no-print">
            Bukti pembayaran dapat diunggah admin melalui menu Transaksi &amp; Struk.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-pad">
      <PageHeader
        title="Daftar Menu"
        description="Pilih kopi, minuman, atau camilan favoritmu."
        actions={
          <button type="button" className="cart-trigger" onClick={() => setCartOpen(true)}>
            <ShoppingCart size={18} /> Keranjang <span>{count}</span>
          </button>
        }
      />

      <div className="menu-toolbar">
        <div className="category-tabs">
          <button type="button" className={category === 'all' ? 'is-active' : ''} onClick={() => setCategory('all')}>Semua</button>
          {categories.map((item) => (
            <button key={item.slug} type="button" className={category === item.slug ? 'is-active' : ''} onClick={() => setCategory(item.slug)}>
              {item.name}
            </button>
          ))}
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Cari menu..." />
      </div>

      {loading ? (
        <Spinner label="Memuat menu..." />
      ) : filtered.length ? (
        <div className="grid grid--4 product-grid">
          {filtered.map((product) => (
            <article key={product.id} className="product-card">
              <div className="product-card__image-wrap">
                <ImageThumb src={product.image_url} alt={product.name} className="product-card__image" />
                <Badge tone="primary">{product.category_name}</Badge>
              </div>
              <div className="product-card__body">
                <h3>{product.name}</h3>
                <p>{product.description || 'Minuman/camilan pilihan Kaliaja.coffe.'}</p>
                <div className="product-card__meta">
                  <strong>{rupiah(product.price)}</strong>
                  <span className={product.stock <= LOW_STOCK_LIMIT ? 'stock stock--low' : 'stock'}>
                    Stok {product.stock}
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  disabled={product.stock <= 0}
                  onClick={() => {
                    addItem(product);
                    toast.success(`${product.name} masuk keranjang.`);
                  }}
                >
                  {product.stock > 0 ? 'Tambah' : 'Habis'}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Menu tidak ditemukan"
          description={products.length ? 'Coba kata kunci atau kategori lain.' : 'Menu belum tersedia. Tambahkan produk melalui dashboard Admin.'}
        />
      )}

      {cartOpen && (
        <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setCartOpen(false)}>
          <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Keranjang">
            <div className="cart-drawer__header">
              <h2><ShoppingBag size={20} /> Keranjang <span>({count})</span></h2>
              <button type="button" className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Tutup keranjang">
                <X size={20} />
              </button>
            </div>

            {items.length ? (
              <>
                <div className="cart-drawer__list">
                  {items.map((item) => (
                    <div key={item.productId} className="cart-item">
                      <ImageThumb src={item.image_url} alt={item.name} className="cart-item__image" />
                      <div className="cart-item__body">
                        <strong>{item.name}</strong>
                        <span>{rupiah(item.price)}</span>
                        <div className="qty-control">
                          <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1)} aria-label="Kurangi">
                            <Minus size={14} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            disabled={item.quantity >= item.stock}
                            aria-label="Tambah"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      <button type="button" className="icon-btn icon-btn--small" onClick={() => removeItem(item.productId)} aria-label="Hapus item">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="cart-drawer__footer">
                  <div className="cart-drawer__total"><span>Total</span><strong>{rupiah(total)}</strong></div>
                  <Button variant="primary" size="lg" loading={submitting} onClick={handleOrder} className="cart-drawer__checkout">
                    Buat Pesanan
                  </Button>
                  <p>Stok akan berkurang otomatis setelah pesanan dibuat.</p>
                </div>
              </>
            ) : (
              <div className="cart-drawer__empty">
                <EmptyState title="Keranjang kosong" description="Tambahkan menu dari daftar untuk memesan." />
                <Button variant="outline" onClick={() => setCartOpen(false)}>Lihat Menu</Button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
