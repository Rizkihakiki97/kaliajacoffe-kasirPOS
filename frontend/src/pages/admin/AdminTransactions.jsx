import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, FileImage, ReceiptText, RefreshCw, Trash2, Upload } from 'lucide-react';
import api from '../../api/client';
import {
  Badge, Button, Card, EmptyState, ImageThumb, Input, PageHeader, SearchInput, Select, Spinner,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { errorMessage, formatDateTime, mediaUrl, rupiah } from '../../utils/format';

const emptyFilters = { source: '', status: '' };

export default function AdminTransactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const toast = useToast();

  const load = useCallback(async (signal) => {
    setLoading(true);
    try {
      const data = await api.transactions.list(filters, signal);
      setTransactions(data?.transactions || []);
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error(errorMessage(error, 'Gagal memuat transaksi.'));
      setTransactions([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const focus = searchParams.get('tx');
    if (focus) {
      setQuery(focus);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return transactions;
    return transactions.filter((item) =>
      String(item.id).includes(needle) || (item.invoice_code || '').toLowerCase().includes(needle));
  }, [transactions, query]);

  const handleUpload = async (id) => {
    const file = files[id];
    if (!file) {
      toast.error('Pilih file struk terlebih dahulu.');
      return;
    }
    setUploadingId(id);
    try {
      await api.transactions.uploadReceipt(id, file);
      setFiles((current) => ({ ...current, [id]: null }));
      await load();
      toast.success('Struk berhasil diunggah.');
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal mengunggah struk.'));
    } finally {
      setUploadingId(null);
    }
  };

  const handleDelete = async (id) => {
    setUploadingId(id);
    try {
      await api.transactions.deleteReceipt(id);
      await load();
      toast.success('Struk dihapus.');
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal menghapus struk.'));
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Transaksi & Upload Struk"
        description="Unggah, ganti, atau hapus bukti pembayaran untuk transaksi kasir maupun pesanan customer."
        actions={<Button variant="outline" icon={RefreshCw} loading={loading} onClick={() => load()}>Muat Ulang</Button>}
      />

      <Card className="panel panel--flush">
        <div className="panel__toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Cari ID atau invoice..." />
          <div className="filter-bar filter-bar--inline">
            <Select value={filters.source} onChange={(event) => setFilters({ ...filters, source: event.target.value })}>
              <option value="">Semua sumber</option>
              <option value="pos">Kasir (POS)</option>
              <option value="order">Order customer</option>
            </Select>
            <Select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Semua status</option>
              <option value="completed">Completed</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <Spinner label="Memuat transaksi..." />
        ) : filtered.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Transaksi</th><th>Waktu</th><th>Sumber</th><th>Total</th><th>Struk</th><th className="text-right">Aksi</th></tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.invoice_code}</strong>
                      <small className="cell-sub">ID #{item.id}</small>
                    </td>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td><Badge tone={item.source === 'pos' ? 'accent' : 'primary'}>{item.source === 'pos' ? 'Kasir' : item.source === 'order' ? 'Order' : item.source}</Badge></td>
                    <td>{item.total_amount != null ? rupiah(item.total_amount) : '—'}</td>
                    <td>
                      {item.receipt_url ? (
                        <a href={mediaUrl(item.receipt_url)} target="_blank" rel="noreferrer" className="receipt-link">
                          <FileImage size={15} /> Lihat struk <ExternalLink size={13} />
                        </a>
                      ) : (
                        <Badge tone="danger">Belum ada</Badge>
                      )}
                    </td>
                    <td>
                      <div className="receipt-actions">
                        <Input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          aria-label={`Pilih struk untuk ${item.invoice_code}`}
                          onChange={(event) => setFiles((current) => ({ ...current, [item.id]: event.target.files?.[0] || null }))}
                        />
                        <Button
                          size="sm"
                          icon={Upload}
                          loading={uploadingId === item.id}
                          onClick={() => handleUpload(item.id)}
                        >
                          {item.receipt_url ? 'Ganti' : 'Unggah'}
                        </Button>
                        {item.receipt_url && (
                          <Button variant="ghost" size="sm" icon={Trash2} className="btn--text-danger" loading={uploadingId === item.id} onClick={() => handleDelete(item.id)}>
                            Hapus
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ReceiptText}
            title={query || filters.source || filters.status ? 'Transaksi tidak ditemukan' : 'Belum ada transaksi'}
            description="Transaksi dari kasir dan pesanan customer muncul di sini setelah dibuat."
          />
        )}
      </Card>

      <p className="footnote">
        Daftar transaksi diambil langsung dari backend. Rekap lengkap tetap tersedia di dashboard BOS.
      </p>

      {filtered.some((item) => item.receipt_url) && (
        <Card className="panel receipt-gallery">
          <div className="panel__header"><h2>Pratinjau struk terbaru</h2></div>
          <div className="receipt-gallery__grid">
            {filtered.filter((item) => item.receipt_url).slice(0, 6).map((item) => (
              <a key={item.id} href={mediaUrl(item.receipt_url)} target="_blank" rel="noreferrer" className="receipt-gallery__item">
                <ImageThumb src={item.receipt_url} alt={`Struk ${item.invoice_code}`} />
                <span>{item.invoice_code}</span>
              </a>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
