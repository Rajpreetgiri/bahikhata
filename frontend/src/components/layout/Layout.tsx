import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Truck, Package, FileText, History,
  Settings, Bell, TrendingUp, TrendingDown, Plus, X, CreditCard, Trophy, BookOpen, Briefcase,
} from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';

// ── Desktop sidebar nav sections ─────────────────────────────────────────────

const mainNav = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/suppliers', icon: Truck, label: 'Suppliers' },
];

const businessNav = [
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/cashbook', icon: BookOpen, label: 'Cashbook' },
  { to: '/expenses', icon: TrendingDown, label: 'Expenses' },
  { to: '/pagar-khata', icon: Briefcase, label: 'PagarKhata' },
  { to: '/history', icon: History, label: 'History' },
];

const moreNav = [
  { to: '/reminders', icon: Bell, label: 'Reminders' },
  { to: '/reports', icon: TrendingUp, label: 'Reports' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/payout-settings', icon: CreditCard, label: 'Payout' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

// ── Mobile bottom nav (5 most accessed) ──────────────────────────────────────

const mobileNav = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/settings', icon: Settings, label: 'More' },
];

// ── FAB quick actions ─────────────────────────────────────────────────────────

const fabActions = [
  { label: 'New Invoice', icon: FileText, to: '/invoices/create', color: 'bg-green-500' },
  { label: 'Add Product', icon: Package, to: '/inventory', color: 'bg-purple-500' },
  { label: 'Add Customer', icon: Users, to: '/customers', color: 'bg-brand-500' },
  { label: 'Add Supplier', icon: Truck, to: '/suppliers', color: 'bg-orange-500' },
  { label: 'Add Expense', icon: TrendingDown, to: '/expenses', color: 'bg-red-500' },
];

function SidebarLink({ to, icon: Icon, label }: { to: string; icon: typeof Bell; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors font-medium text-sm ${isActive ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-100'
        }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const { unreadCount } = useNotificationStore();
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* ── Desktop Sidebar ───────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 fixed top-0 bottom-0 left-0 border-r border-gray-100 bg-white z-30">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="text-lg font-bold text-brand-600">UdhaariBook</p>
          <p className="text-xs text-gray-400">Digital Khata Manager</p>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-1">Main</p>
            {mainNav.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-1">Business</p>
            {businessNav.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-1">More</p>
            {moreNav.map((item) => (
              <div key={item.to} className="relative">
                <SidebarLink {...item} />
                {item.to === '/' && unreadCount > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCount}
                  </span>
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Quick action button */}
        <div className="px-4 py-4 border-t border-gray-100">
          <button
            onClick={() => navigate('/invoices/create')}
            className="w-full flex items-center justify-center gap-2 bg-brand-500 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-600 transition-colors text-sm"
          >
            <Plus size={16} />
            New Invoice
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main
        className="flex-1 md:ml-60 overflow-y-auto
                   pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0
                   pt-[env(safe-area-inset-top,0px)] md:pt-0"
      >
        <div className="w-full md:mx-auto min-h-full">
          <Outlet />
        </div>
      </main>

      {/* ── Mobile Bottom Nav ─────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around py-2">
          {mobileNav.map(({ to, icon: Icon, label }, idx) => {
            // Center slot: FAB button instead of nav link
            if (idx === 2) {
              return (
                <div key="fab-slot" className="relative flex flex-col items-center">
                  {/* FAB action sheet */}
                  {fabOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setFabOpen(false)}
                      />
                      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
                        {fabActions.map((action) => (
                          <button
                            key={action.to}
                            onClick={() => { setFabOpen(false); navigate(action.to); }}
                            className={`flex items-center gap-2.5 ${action.color} text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-lg whitespace-nowrap`}
                          >
                            <action.icon size={16} />
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {/* FAB button itself */}
                  <button
                    onClick={() => setFabOpen((v) => !v)}
                    className={`w-14 h-14 -mt-5 rounded-2xl shadow-lg flex items-center justify-center transition-all ${fabOpen ? 'bg-gray-700 rotate-45' : 'bg-brand-500'
                      }`}
                  >
                    {fabOpen ? <X size={24} className="text-white" /> : <Plus size={26} className="text-white" />}
                  </button>
                  <span className="text-[10px] font-medium text-gray-400 mt-0.5">Quick</span>
                </div>
              );
            }
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${isActive ? 'text-brand-500' : 'text-gray-400'
                  }`
                }
              >
                <div className="relative">
                  <Icon size={22} />
                  {/* Notification badge on Home */}
                  {to === '/' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border border-white" />
                  )}
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
