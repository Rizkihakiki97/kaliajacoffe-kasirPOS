import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { Button, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/format';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error('Konfirmasi password tidak cocok.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      toast.success('Password berhasil diperbarui. Silakan masuk.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal mereset password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Atur password baru"
      subtitle="Gunakan password yang kuat dan belum pernah dipakai."
      footer={<Link to="/login">Kembali ke halaman masuk</Link>}
    >
      {!token ? (
        <div className="form-notice form-notice--error">
          <h3>Tautan tidak valid</h3>
          <p>Tautan reset tidak ditemukan. Minta tautan baru dari halaman lupa password.</p>
          <Link to="/forgot-password" className="btn btn--outline">Minta Tautan Baru</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="form-stack">
          <Field label="Password baru" required hint="Minimal 8 karakter.">
            <div className="input-group">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                placeholder="Password baru"
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
              <button type="button" className="input-group__btn" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>
          <Field label="Konfirmasi password" required>
            <Input type={showPassword ? 'text' : 'password'} value={confirm} placeholder="Ulangi password baru" autoComplete="new-password" onChange={(event) => setConfirm(event.target.value)} required minLength={8} />
          </Field>
          <Button type="submit" size="lg" loading={loading} className="form-submit">Simpan Password</Button>
        </form>
      )}
    </AuthShell>
  );
}
