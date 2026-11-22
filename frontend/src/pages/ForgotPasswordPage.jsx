import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import AuthShell from '../components/AuthShell';
import { Button, Field, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/format';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { forgotPassword } = useAuth();
  const toast = useToast();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (error) {
      toast.error(errorMessage(error, 'Gagal mengirim tautan reset.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Lupa password?"
      subtitle="Masukkan email akunmu untuk menerima tautan reset."
      footer={<Link to="/login">Kembali ke halaman masuk</Link>}
    >
      {sent ? (
        <div className="form-notice">
          <CheckCircle2 size={28} />
          <h3>Cek email kamu</h3>
          <p>Jika email terdaftar, tautan reset password akan dikirim. Tautan berlaku selama 15 menit.</p>
          <Button variant="outline" onClick={() => setSent(false)}>Kirim ulang</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="form-stack">
          <Field label="Email" required>
            <Input type="email" value={email} placeholder="nama@email.com" autoComplete="email" onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Button type="submit" size="lg" loading={loading} className="form-submit">Kirim Tautan Reset</Button>
        </form>
      )}
    </AuthShell>
  );
}
