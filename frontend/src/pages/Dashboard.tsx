import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Users, FileText, Bell, AlertTriangle, Mail,
  TrendingDown, TrendingUp, X, CheckCheck, IndianRupee,
  Wallet, ArrowUpRight, ArrowDownLeft, MessageCircle,
  Receipt, CheckCircle, CreditCard, Megaphone,
} from 'lucide-react';
import type { NotificationType } from '../store/notificationStore';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useCustomerStore } from '../store/customerStore';
import { useExpenseStore } from '../store/expenseStore';
import { useNotificationStore } from '../store/notificationStore';
import { useWalletStore } from '../store/walletStore';
import CustomerCard from '../components/features/CustomerCard';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import api from '../lib/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { customers, loadCustomers, addCustomer, isLoading } = useCustomerStore();
  const { summary: expenseSummary, loadSummary: loadExpenseSummary } = useExpenseStore();
  const { notifications, unreadCount, load: loadNotifications, markRead, markAllRead } = useNotificationStore();
  const { wallet, loadWallet } = useWalletStore();
  const [recentTxns, setRecentTxns] = useState<Array<{
    _id: string; type: 'gave' | 'got'; amount: number; createdAt: string;
    customerId: { _id: string; name: string } | string;
  }>>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [adding, setAdding] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCustomers();
    loadNotifications();
    loadWallet();
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    loadExpenseSummary(monthStart);
    api.get<typeof recentTxns>('/api/transactions/recent?limit=3')
      .then((r) => setRecentTxns(r.data))
      .catch(() => { });
  }, []);

  // Close notification panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications]);

  // ── Notification helpers ──────────────────────────────────────────────────
  function notifIcon(type: NotificationType) {
    switch (type) {
      case 'transaction_gave':   return { icon: ArrowDownLeft,  bg: 'bg-red-100',    color: 'text-red-500' };
      case 'transaction_got':    return { icon: ArrowUpRight,   bg: 'bg-green-100',  color: 'text-green-500' };
      case 'invoice_credit':     return { icon: Receipt,        bg: 'bg-orange-100', color: 'text-orange-500' };
      case 'invoice_paid':       return { icon: CreditCard,     bg: 'bg-blue-100',   color: 'text-blue-500' };
      case 'invoice_settled':    return { icon: CheckCircle,    bg: 'bg-emerald-100',color: 'text-emerald-600' };
      case 'invoice_partial':    return { icon: CreditCard,     bg: 'bg-yellow-100', color: 'text-yellow-600' };
      case 'reminder_sent':      return { icon: Bell,           bg: 'bg-purple-100', color: 'text-purple-500' };
      case 'bulk_reminder':      return { icon: Mail,           bg: 'bg-purple-100', color: 'text-purple-500' };
      case 'admin_broadcast':    return { icon: Megaphone,      bg: 'bg-gray-100',   color: 'text-gray-500' };
      default:                   return { icon: MessageCircle,  bg: 'bg-gray-100',   color: 'text-gray-500' };
    }
  }

  function handleNotifClick(n: { _id: string; isRead: boolean; metadata: Record<string, unknown> }) {
    if (!n.isRead) markRead(n._id);
    const cid = n.metadata?.customerId as string | undefined;
    if (cid) {
      setShowNotifications(false);
      navigate(`/customers/${cid}`);
    }
  }

  const totalOutstanding = customers.reduce((s, c) => s + Math.max(0, c.totalOutstanding), 0);
  const totalAdvances = customers.reduce((s, c) => s + Math.max(0, -c.totalOutstanding), 0);
  const customersWithDues = customers.filter((c) => c.totalOutstanding > 0);
  const customersWithEmail = customersWithDues.filter((c) => c.email);

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) { toast.error('Enter customer name'); return; }
    setAdding(true);
    try {
      await addCustomer(newCustomer);
      setShowAddModal(false);
      setNewCustomer({ name: '', phone: '', email: '' });
      toast.success('Customer added!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to add customer'));
    } finally {
      setAdding(false);
    }
  };

  const handleBulkReminder = async () => {
    setShowBulkConfirm(false);
    setBulkSending(true);
    try {
      const res = await api.post<{ sent: number; failed: number; total: number }>('/api/reminders/bulk');
      if (res.data.failed > 0) {
        toast(`Sent: ${res.data.sent}  Failed: ${res.data.failed}`, { icon: <Mail size={16} className="text-blue-500" /> });
      } else {
        toast.success(`Reminders sent to ${res.data.sent} customers!`);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Bulk reminder failed'));
    } finally {
      setBulkSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* ── Colored Header ─────────────────────────────────────────────── */}
      <div className="bg-brand-500 px-5 pt-12 pb-5 md:pt-6">

        {/* Top row: greeting + right actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0 flex-1">
            <p className="text-brand-200 text-xs font-medium">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
            <h1 className="text-white text-lg font-bold truncate">
              {user?.businessName || user?.ownerName}
            </h1>
          </div>

          {/* Right-side actions: Wallet + Bell grouped together */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Wallet Balance pill */}
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-2"
            >
              <Wallet size={15} className="text-white/80" />
              <span className="text-white text-xs font-bold">
                ₹{(wallet?.balance ?? 0).toFixed(0)}
              </span>
            </button>

            {/* Notification Bell */}
            <div className="relative flex-shrink-0" ref={notifRef}>
              <button
                onClick={() => setShowNotifications((v) => !v)}
                className="relative w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"
              >
                <Bell size={20} className="text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">Notifications</p>
                      {unreadCount > 0 && (
                        <span className="bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs text-brand-500 font-medium flex items-center gap-1"
                        >
                          <CheckCheck size={13} />
                          All read
                        </button>
                      )}
                      <button onClick={() => setShowNotifications(false)} className="text-gray-400">
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* List */}
                  <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center">
                        <Bell size={28} className="mx-auto text-gray-200 mb-2" />
                        <p className="text-gray-400 text-sm">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const { icon: Icon, bg, color } = notifIcon(n.type ?? 'admin_broadcast');
                        const hasLink = !!n.metadata?.customerId;
                        return (
                          <button
                            key={n._id}
                            onClick={() => handleNotifClick(n)}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-indigo-50/60' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Type icon */}
                              <div className={`w-9 h-9 ${bg} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                <Icon size={15} className={color} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className={`text-sm font-semibold truncate ${n.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                                    {n.title}
                                  </p>
                                  {!n.isRead && (
                                    <span className="w-1.5 h-1.5 bg-brand-500 rounded-full flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-[11px] text-gray-400">
                                    {new Date(n.createdAt).toLocaleDateString('en-IN', {
                                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                    })}
                                  </p>
                                  {hasLink && (
                                    <span className="text-[11px] text-brand-500 font-medium">View →</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metric cards grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white/15 rounded-2xl p-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <IndianRupee size={12} className="text-white/70" />
              <p className="text-white/70 text-xs font-medium">Total Outstanding</p>
            </div>
            <p className="text-white text-xl font-bold">₹{totalOutstanding.toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-white/15 rounded-2xl p-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Users size={12} className="text-white/70" />
              <p className="text-white/70 text-xs font-medium">Customers Due</p>
            </div>
            <p className="text-white text-xl font-bold">{customersWithDues.length}</p>
            <p className="text-white/50 text-xs">{customers.length} total</p>
          </div>

          {totalAdvances > 0 && (
            <div className="bg-green-500/30 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={12} className="text-white/70" />
                <p className="text-white/70 text-xs font-medium">Advances</p>
              </div>
              <p className="text-white text-xl font-bold">₹{totalAdvances.toLocaleString('en-IN')}</p>
            </div>
          )}

          {expenseSummary && expenseSummary.grandTotal > 0 && (
            <button
              onClick={() => navigate('/expenses')}
              className="bg-red-500/30 rounded-2xl p-3.5 text-left"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown size={12} className="text-white/70" />
                <p className="text-white/70 text-xs font-medium">This Month Exp.</p>
              </div>
              <p className="text-white text-xl font-bold">₹{expenseSummary.grandTotal.toLocaleString('en-IN')}</p>
            </button>
          )}
        </div>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Quick Actions</p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 flex flex-col items-center gap-1 bg-brand-50 text-brand-600 font-semibold py-3 rounded-xl hover:bg-brand-100 transition-colors"
          >
            <Users size={18} />
            <span className="text-xs">Add Customer</span>
          </button>
          <button
            onClick={() => navigate('/invoices/create')}
            className="flex-1 flex flex-col items-center gap-1 bg-green-50 text-green-600 font-semibold py-3 rounded-xl hover:bg-green-100 transition-colors"
          >
            <FileText size={18} />
            <span className="text-xs">New Invoice</span>
          </button>
          <button
            onClick={() => navigate('/expenses')}
            className="flex-1 flex flex-col items-center gap-1 bg-red-50 text-red-500 font-semibold py-3 rounded-xl hover:bg-red-100 transition-colors"
          >
            <TrendingDown size={18} />
            <span className="text-xs">Add Expense</span>
          </button>
          <button
            onClick={() => setShowBulkConfirm(true)}
            disabled={bulkSending || customersWithDues.length === 0}
            className="flex-1 flex flex-col items-center gap-1 bg-orange-50 text-orange-600 font-semibold py-3 rounded-xl hover:bg-orange-100 transition-colors disabled:opacity-40"
          >
            <Bell size={18} />
            <span className="text-xs">{bulkSending ? 'Sending...' : 'Remind All'}</span>
          </button>
        </div>
      </div>

      {/* ── Recent Transactions ─────────────────────────────────────────── */}
      {recentTxns.length > 0 && (
        <div className="bg-white border-b border-gray-100">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Activity</p>
            <button onClick={() => navigate('/history')} className="text-xs text-brand-500 font-medium">
              View all →
            </button>
          </div>
          {recentTxns.map((tx) => {
            const cust = typeof tx.customerId === 'object' ? tx.customerId : null;
            return (
              <div key={tx._id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${tx.type === 'got' ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                  {tx.type === 'got'
                    ? <ArrowDownLeft size={15} className="text-green-500" />
                    : <ArrowUpRight size={15} className="text-red-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {cust?.name ?? 'Customer'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {tx.type === 'got' ? 'Received' : 'Gave'} ·{' '}
                    {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <p className={`font-bold text-sm ${tx.type === 'got' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'got' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Customer list ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Add your first customer to start tracking"
            action={
              <button onClick={() => setShowAddModal(true)} className="btn-primary max-w-xs">
                Add Customer
              </button>
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Customers ({customers.length})
              </p>
              <button
                onClick={() => navigate('/customers')}
                className="text-xs text-brand-500 font-medium"
              >
                View all →
              </button>
            </div>
            {customers.map((c) => (
              <CustomerCard key={c._id} customer={c} />
            ))}
          </>
        )}
      </div>

      {/* ── Add Customer Modal ──────────────────────────────────────────── */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Customer">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              placeholder="Customer name"
              className="input-field"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              type="tel"
              placeholder="e.g. 9876543210"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              type="email"
              placeholder="customer@email.com"
              className="input-field"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAddCustomer} disabled={adding} className="btn-primary">
              {adding ? 'Adding...' : 'Add Customer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Bulk Reminder Confirm ───────────────────────────────────────── */}
      <Modal open={showBulkConfirm} onClose={() => setShowBulkConfirm(false)} title="Send Bulk Reminder?">
        <div className="flex gap-3 mb-5">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-orange-500" />
          </div>
          <div>
            <p className="text-gray-800 font-medium text-sm">Email reminder bheja jaayega:</p>
            <ul className="mt-2 space-y-1">
              <li className="text-sm text-gray-600">
                • <strong>{customersWithDues.length}</strong> customers with outstanding dues
              </li>
              <li className="text-sm text-gray-600">
                • <strong>{customersWithEmail.length}</strong> have email (will receive)
              </li>
              {customersWithDues.length - customersWithEmail.length > 0 && (
                <li className="text-sm text-orange-500">
                  • {customersWithDues.length - customersWithEmail.length} skipped (no email)
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowBulkConfirm(false)} className="btn-secondary">Cancel</button>
          <button
            onClick={handleBulkReminder}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Send {customersWithEmail.length} Reminders
          </button>
        </div>
      </Modal>
    </div>
  );
}
