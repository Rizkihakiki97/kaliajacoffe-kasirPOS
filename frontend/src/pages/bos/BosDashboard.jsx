import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, FileImage, Package, Palette, ReceiptText, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { Badge, Button, Card, EmptyState, ImageThumb, Input, PageHeader, Select, Spinner, StatCard } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { errorMessage, formatDateTime, mediaUrl, rupiah } from '../../utils/format';

const emptyFilters = { source: '', flow_type: '', status: '', start: '', end: '' };

export default function BosDashboard() {
  const [data, setData] = useState({ summary: { total_in: 0, total_out: 0, count: 0 }, transactions: [] });
  const [stocks, setStocks] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState([]);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [transactionData, stockData] = await Promise.all([
        api.bos.transactions(filters),
        api.bos.stocks(),
      ]);
      setData(transactionData || { summary: {}, transactions: [] });
      setStocks(stockData || []);
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal memuat data BOS.'));
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => { load(); }, [load]);

  const summary = data.summary || {};
  const transactions = data.transactions || [];
  const toggle = (id) => setExpanded((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  return (
    <>
      <PageHeader
        title="Dashboard BOS"
        description="Pantau seluruh transaksi masuk, transaksi keluar, dan sisa stok."
        actions={<Button variant="outline" icon={RefreshCw} onClick={load} loading={loading}>Muat Ulang</Button>}
      />

      {loading ? (
        <Spinner label="Memuat laporan..." />
      ) : (
        <>
          <div className="stats-grid">
            <StatCard label="Transaksi Masuk" value={rupiah(summary.total_in)} hint="Pesanan customer" icon={ArrowDownLeft} tone="green" />
            <StatCard label="Transaksi Keluar" value={rupiah(summary.total_out)} hint="Kasir / POS" icon={ArrowUpRight} tone="accent" />
            <StatCard label="Jumlah Transaksi" value={summary.count || 0} hint="Seluruh transaksi" icon={ReceiptText} />
            <StatCard label="Produk Terdaftar" value={stocks.length} hint="Coffee, Non-Coffee, Snack" icon={Package} tone="green" />
          </div>

          <Card className="panel">
            <div className="panel__header"><h2>Rekap Transaksi</h2></div>
            <div className="filter-bar">
              <Select value={filters.source} onChange={(event) => setFilters({ ...filters, source: event.target.value })}>
                <option value="">Semua sumber</option>
                <option value="order">Order customer</option>
                <option value="pos">Kasir (POS)</option>
              </Select>
              <Select value={filters.flow_type} onChange={(event) => setFilters({ ...filters, flow_type: event.target.value })}>
                <option value="">Semua alur</option>
                <option value="in">Masuk</option>
                <option value="out">Keluar</option>
              </Select>
              <Select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                <option value="">Semua status</option>
                <option value="completed">Completed</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </Select>
              <Input type="date" value={filters.start} onChange={(event) => setFilters({ ...filters, start: event.target.value })} aria-label="Tanggal mulai" />
              <Input type="date" value={filters.end} onChange={(event) => setFilters({ ...filters, end: event.target.value })} aria-label="Tanggal akhir" />
              <Button variant="ghost" size="sm" onClick={() => setFilters(emptyFilters)}>Reset</Button>
            </div>

            {transactions.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Invoice</th><th>Waktu</th><th>Sumber</th><th>Alur</th><th>Status</th><th>Total</th><th>Struk</th><th /></tr>
                  </thead>
                  <tbody>
                    {transactions.map((item) => (
                      <Fragment key={item.id}>
                        <tr>
                          <td><strong>{item.invoice_code}</strong><small className="cell-sub">ID #{item.id}</small></td>
                          <td>{formatDateTime(item.created_at)}</td>
                          <td><Badge tone={item.source === 'pos' ? 'accent' : 'primary'}>{item.source === 'pos' ? 'Kasir' : 'Order'}</Badge></td>
                          <td>
                            <span className={item.flow_type === 'in' ? 'flow flow--in' : 'flow flow--out'}>
                              {item.flow_type === 'in' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                              {item.flow_type === 'in' ? 'Masuk' : 'Keluar'}
                            </span>
                          </td>
                          <td><Badge tone={item.status === 'completed' ? 'success' : item.status === 'cancelled' ? 'danger' : 'neutral'}>{item.status}</Badge></td>
                          <td><strong>{rupiah(item.total_amount)}</strong></td>
                          <td>
                            {item.receipt_url ? (
                              <a href={mediaUrl(item.receipt_url)} target="_blank" rel="noreferrer" className="receipt-link"><FileImage size={15} /> Lihat</a>
                            ) : <span className="muted">—</span>}
                          </td>
                          <td>
                            <button type="button" className="icon-btn" onClick={() => toggle(item.id)} aria-label="Lihat detail">
                              {expanded.includes(item.id) ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                            </button>
                          </td>
                        </tr>
                        {expanded.includes(item.id) && (
                          <tr className="detail-row">
                            <td colSpan={8}>
                              <div className="detail-panel">
                                <h4>Detail item</h4>
                                {item.items?.length ? (
                                  <ul>
                                    {item.items.map((line) => (
                                      <li key={line.id}>
                                        <span>Produk #{line.product_id} · {line.quantity} × {rupiah(line.price)}</span>
                                        <strong>{rupiah(line.subtotal)}</strong>
                                      </li>
                                    ))}
                                  </ul>
                                ) : <p className="muted">Tidak ada detail item.</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Belum ada transaksi" description="Transaksi dari kasir dan pesanan customer akan tampil di sini." />
            )}
          </Card>

          <Card className="panel">
            <div className="panel__header">
              <h2>Sisa Stok Barang</h2>
              <Link to="/bos/branding" className="text-link"><Palette size={15} /> Logo & Favicon</Link>
            </div>
            {stocks.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Status</th></tr></thead>
                  <tbody>
                    {stocks.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.name}</strong></td>
                        <td>{item.category_name}</td>
                        <td>{rupiah(item.price)}</td>
                        <td>{item.stock}</td>
                        <td><Badge tone={item.low_stock ? 'danger' : 'success'}>{item.low_stock ? 'Menipis' : 'Aman'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Package} title="Belum ada stok" description="Tambahkan produk melalui dashboard Admin." />
            )}
          </Card>
        </>
      )}
    </>
  );
}
