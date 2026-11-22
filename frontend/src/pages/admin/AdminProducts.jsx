import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../api/client';
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, ImageThumb, Input,
  Modal, PageHeader, SearchInput, Select, Spinner, Textarea,
} from '../../components/ui';
import { useCategories } from '../../context/CategoriesContext';
import { useToast } from '../../context/ToastContext';
import { LOW_STOCK_LIMIT } from '../../utils/constants';
import { errorMessage, rupiah } from '../../utils/format';

const emptyForm = { category_id: '', name: '', description: '', price: '', stock: '', image: null };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const toast = useToast();
  const { categories } = useCategories();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.products.list();
      setProducts(data || []);
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal memuat produk.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter((product) =>
      !needle || product.name.toLowerCase().includes(needle) || (product.category_name || '').toLowerCase().includes(needle));
  }, [products, query]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, category_id: String(categories[0]?.id || '') });
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setModalOpen(true);
    setForm({
      category_id: String(categories.find((item) => item.name === product.category_name)?.id || product.category_id || categories[0]?.id || ''),
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      stock: String(product.stock),
      image: null,
    });
  };

  const buildFormData = () => {
    const data = new FormData();
    data.append('category_id', form.category_id);
    data.append('name', form.name.trim());
    data.append('description', form.description.trim());
    data.append('price', form.price);
    data.append('stock', form.stock);
    if (form.image) data.append('image', form.image);
    return data;
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.products.update(editing.id, buildFormData());
        toast.success('Produk diperbarui.');
      } else {
        if (!form.image) {
          toast.error('Foto produk wajib diunggah.');
          setSaving(false);
          return;
        }
        await api.products.create(buildFormData());
        toast.success('Produk ditambahkan.');
      }
      closeModal();
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal menyimpan produk.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.products.remove(deleting.id);
      toast.success('Produk dihapus.');
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal menghapus produk.'));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Manajemen Produk"
        description="Kelola menu Coffee, Non-Coffee, dan Snack beserta stoknya."
        actions={<Button icon={Plus} onClick={openCreate}>Tambah Produk</Button>}
      />

      <Card className="panel">
        <div className="panel__toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Cari produk..." />
          <span className="muted">{filtered.length} produk</span>
        </div>

        {loading ? (
          <Spinner label="Memuat produk..." />
        ) : filtered.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th className="text-right">Aksi</th></tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="cell-with-image">
                        <ImageThumb src={product.image_url} alt={product.name} />
                        <div><strong>{product.name}</strong><small>{product.description || '—'}</small></div>
                      </div>
                    </td>
                    <td><Badge tone="neutral">{product.category_name}</Badge></td>
                    <td>{rupiah(product.price)}</td>
                    <td><Badge tone={product.stock <= LOW_STOCK_LIMIT ? 'danger' : 'success'}>{product.stock}</Badge></td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="icon-btn" onClick={() => openEdit(product)} aria-label={`Edit ${product.name}`}><Pencil size={16} /></button>
                        <button type="button" className="icon-btn icon-btn--danger" onClick={() => setDeleting(product)} aria-label={`Hapus ${product.name}`}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={products.length ? 'Produk tidak ditemukan' : 'Belum ada produk'} description={products.length ? 'Coba kata kunci lain.' : 'Tambahkan menu pertama untuk mulai berjualan.'} action={!products.length ? <Button icon={Plus} onClick={openCreate}>Tambah Produk</Button> : null} />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Produk' : 'Tambah Produk'}
        description={editing ? 'Perbarui data menu. Kosongkan foto bila tidak diganti.' : 'Lengkapi data menu baru.'}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={saving}>Batal</Button>
            <Button type="submit" form="product-form" loading={saving}>{editing ? 'Simpan Perubahan' : 'Tambah Produk'}</Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSave} className="form-grid">
          <Field label="Nama produk" required>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Contoh: Kopi Susu Gula Aren" required />
          </Field>
          <Field label="Kategori" required>
            <Select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </Field>
          <Field label="Harga (Rp)" required>
            <Input type="number" min="1" step="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="18000" required />
          </Field>
          <Field label="Stok" required>
            <Input type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} placeholder="20" required />
          </Field>
          <Field label="Deskripsi" className="field--full">
            <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ceritakan tentang menu ini..." />
          </Field>
          <Field label={editing ? 'Ganti Foto Produk' : 'Foto Produk'} required={!editing} hint="JPG, PNG, GIF, atau WEBP · maks. 5 MB" className="field--full">
            <Input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event) => setForm({ ...form, image: event.target.files?.[0] || null })} />
          </Field>
          {editing?.image_url && !form.image && (
            <div className="form-preview field--full"><span>Preview foto saat ini:</span><ImageThumb src={editing.image_url} alt={editing.name} /></div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Hapus produk?"
        message={`Produk "${deleting?.name || ''}" akan dihapus beserta fotonya. Produk yang sudah dipakai transaksi tidak bisa dihapus.`}
        confirmLabel="Ya, hapus"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
        loading={deleteLoading}
      />
    </>
  );
}
