import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { CartProvider } from './context/CartContext';
import { CategoriesProvider } from './context/CategoriesContext';
import { ToastProvider } from './context/ToastContext';
import PublicLayout from './components/PublicLayout';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import MenuPage from './pages/MenuPage';
import ActivitiesPage from './pages/ActivitiesPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminActivities from './pages/admin/AdminActivities';
import AdminPOS from './pages/admin/AdminPOS';
import AdminTransactions from './pages/admin/AdminTransactions';
import BosDashboard from './pages/bos/BosDashboard';
import BosBranding from './pages/bos/BosBranding';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <BrandingProvider>
          <AuthProvider>
            <CategoriesProvider>
              <CartProvider>
                <Routes>
                  <Route element={<PublicLayout />}>
                    <Route index element={<LandingPage />} />
                    <Route path="menu" element={<MenuPage />} />
                    <Route path="activities" element={<ActivitiesPage />} />
                    <Route path="login" element={<LoginPage />} />
                    <Route path="register" element={<RegisterPage />} />
                    <Route path="forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="reset-password" element={<ResetPasswordPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>

                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute role="admin">
                        <DashboardLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<AdminDashboard />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="activities" element={<AdminActivities />} />
                    <Route path="pos" element={<AdminPOS />} />
                    <Route path="transactions" element={<AdminTransactions />} />
                  </Route>

                  <Route
                    path="/bos"
                    element={
                      <ProtectedRoute role="bos">
                        <DashboardLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<BosDashboard />} />
                    <Route path="branding" element={<BosBranding />} />
                  </Route>
                </Routes>
              </CartProvider>
            </CategoriesProvider>
          </AuthProvider>
        </BrandingProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
