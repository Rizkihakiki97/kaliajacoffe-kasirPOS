import { Navigate, useLocation } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ role, children }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="route-loading">
        <LoaderCircle size={28} className="spin" />
        <span>Menyiapkan sesi...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    const fallback = user.role === 'admin' ? '/admin' : user.role === 'bos' ? '/bos' : '/';
    return <Navigate to={fallback} replace />;
  }

  return children;
}
