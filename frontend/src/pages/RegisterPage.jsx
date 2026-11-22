import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { Button, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/format';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Konfirmasi password tidak cocok.');
      return;
    }
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      toast.success('Registrasi berhasil. Silakan masuk.');
      navigate('/login');
    } catch (error) {
      toast.error(errorMessage(error, 'Registrasi gagal.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Buat akun baru"
      subtitle="Daftar untuk memesan menu favoritmu."
      footer={
        <>
          Sudah punya akun? <Link to="/login">Masuk</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="form-stack">
        <Field label="Nama lengkap" required>
          <Input value={form.name} placeholder="Nama kamu" autoComplete="name" onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={form.email} placeholder="nama@email.com" autoComplete="email" onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        </Field>
        <Field label="Password" required hint="Minimal 8 karakter.">
          <div className="input-group">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              placeholder="Buat password"
              autoComplete="new-password"
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
              minLength={8}
            />
            <button type="button" className="input-group__btn" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </Field>
        <Field label="Konfirmasi password" required>
          <Input type={showPassword ? 'text' : 'password'} value={form.confirm} placeholder="Ulangi password" autoComplete="new-password" onChange={(event) => setForm({ ...form, confirm: event.target.value })} required minLength={8} />
        </Field>
        <Button type="submit" size="lg" loading={loading} className="form-submit">Daftar</Button>
      </form>
    </AuthShell>
  );
}
