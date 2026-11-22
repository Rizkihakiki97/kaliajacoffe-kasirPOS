import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '../../api/client';
import {
  Button, Card, ConfirmDialog, EmptyState, Field, ImageThumb, Input,
  Modal, PageHeader, Spinner, Textarea,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { errorMessage, formatDate, todayInput } from '../../utils/format';

const emptyForm = { title: '', description: '', event_date: todayInput(), image: null };

export default function AdminActivities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.activities.list();
      setActivities(data || []);
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal memuat kegiatan.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };
  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (activity) => {
    setEditing(activity);
    setForm({
      title: activity.title,
      description: activity.description || '',
      event_date: activity.event_date ? new Date(activity.event_date).toISOString().slice(0, 10) : todayInput(),
      image: null,
    });
    setModalOpen(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!editing && !form.image) {
      toast.error('Foto kegiatan wajib diunggah.');
      return;
    }
    setSaving(true);
    try {
      const data = new FormData();
      data.append('title', form.title.trim());
      data.append('description', form.description.trim());
      data.append('event_date', form.event_date);
      if (form.image) data.append('image', form.image);
      if (editing) {
        await api.activities.update(editing.id, data);
        toast.success('Kegiatan diperbarui.');
      } else {
        await api.activities.create(data);
        toast.success('Kegiatan ditambahkan.');
      }
      closeModal();
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal menyimpan kegiatan.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.activities.remove(deleting.id);
      toast.success('Kegiatan dihapus.');
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal menghapus kegiatan.'));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Galeri Kegiatan"
        description="Upload dan kelola foto kegiatan kafe yang tampil di landing page."
        actions={<Button icon={Plus} onClick={openCreate}>Tambah Kegiatan</Button>}
      />

      {loading ? (
        <Spinner label="Memuat kegiatan..." />
      ) : activities.length ? (
        <div className="grid grid--3">
          {activities.map((activity) => (
            <Card key={activity.id} className="activity-admin">
              <ImageThumb src={activity.image_url} alt={activity.title} className="activity-admin__image" />
              <div className="activity-admin__body">
                <span className="activity-admin__date"><CalendarDays size={14} /> {formatDate(activity.event_date)}</span>
                <h3>{activity.title}</h3>
                <p>{activity.description || 'Tanpa deskripsi.'}</p>
                <div className="row-actions">
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(activity)}>Edit</Button>
                  <Button variant="ghost" size="sm" icon={Trash2} className="btn--text-danger" onClick={() => setDeleting(activity)}>Hapus</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="panel">
          <EmptyState title="Belum ada kegiatan" description="Tambahkan foto kegiatan pertama untuk ditampilkan di galeri." action={<Button icon={Plus} onClick={openCreate}>Tambah Kegiatan</Button>} />
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Kegiatan' : 'Tambah Kegiatan'}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={saving}>Batal</Button>
            <Button type="submit" form="activity-form" loading={saving}>{editing ? 'Simpan Perubahan' : 'Tambah Kegiatan'}</Button>
          </>
        }
      >
        <form id="activity-form" onSubmit={handleSave} className="form-grid">
          <Field label="Judul kegiatan" required>
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Contoh: Kopi Senja Bareng Komunitas" required />
          </Field>
          <Field label="Tanggal kegiatan" required>
            <Input type="date" value={form.event_date} onChange={(event) => setForm({ ...form, event_date: event.target.value })} required />
          </Field>
          <Field label="Deskripsi" className="field--full">
            <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ceritakan kegiatan ini..." />
          </Field>
          <Field label={editing ? 'Ganti Foto' : 'Foto Kegiatan'} required={!editing} hint="JPG, PNG, GIF, atau WEBP · maks. 5 MB" className="field--full">
            <Input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event) => setForm({ ...form, image: event.target.files?.[0] || null })} />
          </Field>
          {editing && !form.image && <div className="form-preview field--full"><span>Foto saat ini:</span><ImageThumb src={editing.image_url} alt={editing.title} /></div>}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Hapus kegiatan?"
        message={`Kegiatan "${deleting?.title || ''}" dan fotonya akan dihapus permanen.`}
        confirmLabel="Ya, hapus"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
        loading={deleteLoading}
      />
    </>
  );
}
