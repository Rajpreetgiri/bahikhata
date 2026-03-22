import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminStore } from '../../store/adminStore';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  ArrowLeftRight,
  FileText,
  Wallet,
  Bell,
  BellRing,
  LogOut,
  ChevronRight,
  CreditCard,
} from 'lucide-react';

const nav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/merchants', label: 'Merchants', icon: UserCheck },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/admin/invoices', label: 'Invoices', icon: FileText },
  { to: '/admin/wallets', label: 'Wallets', icon: Wallet },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/reminders', label: 'Reminders', icon: Bell },
  { to: '/admin/notifications', label: 'Notifications', icon: BellRing },
];

export default function AdminLayout() {
  const logout = useAdminStore((s) => s.logout);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-gray-800">
          <span className="font-bold text-lg text-white">UdhaariBook</span>
          <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">Admin</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <Outlet />
      </main>
    </div>
  );
}
