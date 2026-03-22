import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useAdminStore } from './store/adminStore';
import { usePinStore } from './store/pinStore';
import LoginPage from './pages/LoginPage';
import OTPPage from './pages/OTPPage';
import OnboardingPage from './pages/OnboardingPage';
import Dashboard from './pages/Dashboard';
import CustomersPage from './pages/CustomersPage';
import CustomerDetail from './pages/CustomerDetail';
import RemindersPage from './pages/RemindersPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import InventoryPage from './pages/InventoryPage';
import InvoicesPage from './pages/InvoicesPage';
import CreateInvoicePage from './pages/CreateInvoicePage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import PayoutSettingsPage from './pages/PayoutSettingsPage';
import SuppliersPage from './pages/SuppliersPage';
import SupplierDetail from './pages/SupplierDetail';
import HistoryPage from './pages/HistoryPage';
import ExpensesPage from './pages/ExpensesPage';
import WalletHistoryPage from './pages/WalletHistoryPage';
import CustomerLeaderboardPage from './pages/CustomerLeaderboardPage';
import CashbookPage from './pages/CashbookPage';
import ScheduledRemindersPage from './pages/ScheduledRemindersPage';
import BusinessSelectPage from './pages/BusinessSelectPage';
import StaffPage from './pages/StaffPage';
import StaffInvitePage from './pages/StaffInvitePage';
import BusinessCardPage from './pages/BusinessCardPage';
import MyBusinessesPage from './pages/MyBusinessesPage';
import PagarKhataPage from './pages/PagarKhataPage';
import PinLockScreen from './components/PinLockScreen';
import Layout from './components/layout/Layout';

// Admin
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminMerchantsPage from './pages/admin/AdminMerchantsPage';
import AdminMerchantDetail from './pages/admin/AdminMerchantDetail';
import AdminCustomersPage from './pages/admin/AdminCustomersPage';
import AdminTransactionsPage from './pages/admin/AdminTransactionsPage';
import AdminInvoicesPage from './pages/admin/AdminInvoicesPage';
import AdminWalletsPage from './pages/admin/AdminWalletsPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminRemindersPage from './pages/admin/AdminRemindersPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';

function RequireAdminAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAdminStore();
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAuthenticated && user && !user.isOnboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RequireNoAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { lock, isPinEnabled } = usePinStore();
  const { isAuthenticated } = useAuthStore();

  // Auto-lock when tab becomes hidden
  useEffect(() => {
    const handle = () => {
      if (document.hidden && isPinEnabled && isAuthenticated) lock();
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [isPinEnabled, isAuthenticated, lock]);

  const { isLocked } = usePinStore();

  return (
    <>
      {isLocked && <PinLockScreen />}
      <Routes>
        {/* Public / auth */}
        <Route path="/login" element={<RequireNoAuth><LoginPage /></RequireNoAuth>} />
        <Route path="/verify-otp" element={<RequireNoAuth><OTPPage /></RequireNoAuth>} />
        <Route path="/select-business" element={<BusinessSelectPage />} />
        <Route path="/staff-invite" element={<StaffInvitePage />} />

        {/* Onboarding */}
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Public payment callback */}
        <Route path="/payment-success" element={<PaymentSuccessPage />} />

        {/* Protected routes inside Layout */}
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/reminders" element={<RemindersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/create" element={<CreateInvoicePage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/payout-settings" element={<PayoutSettingsPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/suppliers/:id" element={<SupplierDetail />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/wallet-history" element={<WalletHistoryPage />} />
          <Route path="/leaderboard" element={<CustomerLeaderboardPage />} />
          <Route path="/cashbook" element={<CashbookPage />} />
          <Route path="/scheduled-reminders" element={<ScheduledRemindersPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/business-card" element={<BusinessCardPage />} />
          <Route path="/businesses" element={<MyBusinessesPage />} />
          <Route path="/pagar-khata" element={<PagarKhataPage />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RequireAdminAuth><AdminLayout /></RequireAdminAuth>}>
          <Route index element={<AdminDashboard />} />
          <Route path="merchants" element={<AdminMerchantsPage />} />
          <Route path="merchants/:id" element={<AdminMerchantDetail />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="transactions" element={<AdminTransactionsPage />} />
          <Route path="invoices" element={<AdminInvoicesPage />} />
          <Route path="wallets" element={<AdminWalletsPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="reminders" element={<AdminRemindersPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
