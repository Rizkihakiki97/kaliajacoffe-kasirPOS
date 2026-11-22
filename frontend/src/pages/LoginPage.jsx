import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { Button, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/format';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await login(form);
      const wantedMenu = from === '/menu' && data.role === 'customer';
      navigate(wantedMenu ? '/menu' : data.redirect || '/', { replace: true });
      toast.success(`Selamat datang kembali, ${data.name.split(' ')[0]}!`);
    } catch (error) {
      toast.error(errorMessage(error, 'Login gagal.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Masuk ke akunmu"
      subtitle="Gunakan email dan password yang sudah terdaftar."
      footer={
        <>
          Belum punya akun? <Link to="/register">Daftar sekarang</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="form-stack">
        <Field label="Email" required>
          <Input
            type="email"
            autoComplete="email"
            placeholder="nama@email.com"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </Field>
        <Field label="Password" required>
          <div className="input-group">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Minimal 8 karakter"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
            <button type="button" className="input-group__btn" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </Field>
        <div className="form-links">
          <Link to="/forgot-password">Lupa password?</Link>
        </div>
        <Button type="submit" size="lg" loading={loading} className="form-submit">Masuk</Button>
      </form>
    </AuthShell>
  );
}
