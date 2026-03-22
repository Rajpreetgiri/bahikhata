import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store, Bell, LogOut, ChevronRight, Shield, Pencil, TrendingUp, Clock,
  Wallet, Plus, MessageSquare, CheckCircle, History, Package, Truck,
  TrendingDown, Trophy, FileText, QrCode, Download, Lock, Users, CreditCard,
  Building2, Briefcase,
} from 'lucide-react';
import { usePayoutStore } from '../store/payoutStore';
import { useWalletStore } from '../store/walletStore';
import { useAuthStore } from '../store/authStore';
import { usePinStore } from '../store/pinStore';
import { useTranslation } from 'react-i18next';
import { requestFCMToken } from '../lib/firebase';
import { getCategoryConfig } from '../config/categories';
import { openRazorpayCheckout } from '../lib/razorpay';
import PageHeader from '../components/layout/PageHeader';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../lib/api';
import { BUSINESS_CATEGORIES, BusinessCategoryId } from '../types';

const TOPUP_PRESETS = [20, 50, 100, 200, 500];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuthStore();
  const { i18n } = useTranslation();
  const { account: payoutAccount, loadAccount: loadPayoutAccount } = usePayoutStore();
  const { wallet, plans, loadWallet, loadPlans, createTopUpOrder, verifyTopUp, createPackOrder, verifyPackPurchase } = useWalletStore();

  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState('');
  const [payingTopUp, setPayingTopUp] = useState(false);
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);

  useEffect(() => {
    loadPayoutAccount();
    loadWallet();
    loadPlans();
  }, []);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    businessName: user?.businessName ?? '',
    ownerName: user?.ownerName ?? '',
    phone: user?.phone ?? '',
    businessAddress: user?.businessAddress ?? '',
    gstNumber: user?.gstNumber ?? '',
    upiId: user?.upiId ?? '',
    businessCategory: (user?.businessCategory ?? '') as BusinessCategoryId | '',
  });
  const [qrLoading, setQrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);

  // PIN Lock state
  const { isPinEnabled, setPin, disablePin } = usePinStore();
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        businessName: form.businessName,
        ownerName: form.ownerName,
        phone: form.phone,
        businessAddress: form.businessAddress,
        gstNumber: form.gstNumber,
        upiId: form.upiId || undefined,
        ...(form.businessCategory ? { businessCategory: form.businessCategory } : {}),
      });
      setEditing(false);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    setEnablingPush(true);
    try {
      const token = await requestFCMToken();
      if (!token) {
        toast.error('Notification permission denied');
        return;
      }
      await updateProfile({ fcmToken: token });
      toast.success('Push notifications enabled!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to enable notifications'));
    } finally {
      setEnablingPush(false);
    }
  };

  const handleTopUp = async () => {
    const amount = customAmount ? parseFloat(customAmount) : topUpAmount;
    if (!amount || amount < 20) { toast.error('Minimum ₹20 required'); return; }
    setPayingTopUp(true);
    try {
      const order = await createTopUpOrder(amount);
      openRazorpayCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        name: 'UdhaariBook',
        description: 'Wallet Top-up',
        prefill: { name: user?.ownerName, email: user?.email },
        onSuccess: async (resp) => {
          try {
            const balance = await verifyTopUp({ ...resp, amount });
            toast.success(`₹${amount} added! New balance: ₹${balance.toFixed(2)}`);
            setShowTopUp(false);
            setCustomAmount('');
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Payment verification failed'));
          } finally {
            setPayingTopUp(false);
          }
        },
        onFailure: () => { toast.error('Payment cancelled'); setPayingTopUp(false); },
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to initiate payment'));
      setPayingTopUp(false);
    }
  };

  const handleBuyPlan = async (planId: string, planLabel: string, planSMS: number) => {
    setBuyingPlan(planId);
    try {
      const order = await createPackOrder(planId);
      openRazorpayCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        name: 'UdhaariBook',
        description: order.label,
        prefill: { name: user?.ownerName, email: user?.email },
        onSuccess: async (resp) => {
          try {
            await verifyPackPurchase({ ...resp, plan: planId });
            toast.success(`${planLabel} activated! ${planSMS} SMS ready to use.`);
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Pack activation failed'));
          } finally {
            setBuyingPlan(null);
          }
        },
        onFailure: () => { toast.error('Payment cancelled'); setBuyingPlan(null); },
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to initiate payment'));
      setBuyingPlan(null);
    }
  };

  const handleSavePin = async () => {
    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) { setPinError('PIN must be 4 digits'); return; }
    if (pinInput !== pinConfirm) { setPinError('PINs do not match'); return; }
    await setPin(pinInput);
    setPinInput(''); setPinConfirm(''); setPinError('');
    setShowPinSetup(false);
    toast.success('PIN lock enabled');
  };

  const handleDownloadQR = async () => {
    setQrLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? 'http://localhost:5000'}/api/qr/merchant`,
        { headers: { Authorization: `Bearer ${useAuthStore.getState().token}` } }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message ?? 'Failed to generate QR');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${user?.businessName ?? 'merchant'}_QR.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate QR');
    } finally {
      setQrLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out');
  };

  const categoryInfo = getCategoryConfig(user?.businessCategory);

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Settings" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
        {/* Profile */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Store size={18} className="text-brand-500" />
              <h2 className="font-semibold text-gray-800">Business Profile</h2>
            </div>
            <button
              onClick={() => editing ? handleSave() : setEditing(true)}
              disabled={saving}
              className="flex items-center gap-1.5 text-brand-500 text-sm font-semibold"
            >
              {!editing && <Pencil size={14} />}
              {saving ? 'Saving...' : editing ? 'Save' : 'Edit'}
            </button>
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Business Name</label>
                <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className="input-field text-sm py-2.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Owner Name</label>
                <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} className="input-field text-sm py-2.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} type="tel" className="input-field text-sm py-2.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Business Address</label>
                <textarea value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} className="input-field text-sm py-2.5 resize-none" rows={2} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">GST Number</label>
                <input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })} maxLength={15} className="input-field text-sm py-2.5 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">UPI ID (for QR Code)</label>
                <input value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} placeholder="e.g. 9876543210@upi" className="input-field text-sm py-2.5" />
                <p className="text-xs text-gray-400 mt-1">Used to generate your payment QR code</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Business Category</label>
                <select
                  value={form.businessCategory}
                  onChange={(e) => setForm({ ...form, businessCategory: e.target.value as BusinessCategoryId | '' })}
                  className="input-field text-sm py-2.5"
                >
                  <option value="">Select category</option>
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => setEditing(false)} className="btn-secondary text-sm py-2">
                Cancel
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {categoryInfo && (
                <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-gray-100">
                  <div className={`w-8 h-8 ${categoryInfo.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <categoryInfo.Icon size={16} className={categoryInfo.color} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{categoryInfo.label}</span>
                </div>
              )}
              <InfoRow label="Business" value={user?.businessName || '—'} />
              <InfoRow label="Owner" value={user?.ownerName || '—'} />
              <InfoRow label="Phone" value={user?.phone || '—'} />
              <InfoRow label="Email" value={user?.email || '—'} />
              {user?.businessAddress && <InfoRow label="Address" value={user.businessAddress} />}
              {user?.gstNumber && <InfoRow label="GST" value={user.gstNumber} />}
            </div>
          )}
        </div>

        {/* ── SMS Wallet ───────────────────────────────────────────── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-brand-500" />
              <h2 className="font-semibold text-gray-800">SMS Wallet</h2>
            </div>
            <button onClick={() => navigate('/wallet-history')} className="text-xs text-brand-500 font-medium flex items-center gap-1">
              <History size={13} />
              History
            </button>
          </div>

          {/* Balance row */}
          <div className="flex items-center justify-between bg-brand-50 rounded-2xl px-4 py-3 mb-3">
            <div>
              <p className="text-xs text-brand-400 font-medium">Wallet Balance</p>
              <p className="text-2xl font-bold text-brand-600">
                ₹{(wallet?.balance ?? 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">₹0.40/SMS (without pack)</p>
            </div>
            <button
              onClick={() => setShowTopUp(true)}
              className="flex items-center gap-1.5 bg-brand-500 text-white font-semibold text-sm px-3 py-2 rounded-xl"
            >
              <Plus size={15} />
              Add Money
            </button>
          </div>

          {/* Active SMS Pack */}
          {wallet?.activePack && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-4 py-3 mb-3">
              <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-700">SMS Pack Active</p>
                <p className="text-xs text-green-600">
                  {wallet.activePack.remaining} / {wallet.activePack.total} SMS remaining
                </p>
                <p className="text-xs text-gray-400">
                  Expires {new Date(wallet.activePack.expiresAt).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>
          )}

          {/* SMS Plans */}
          <p className="text-xs font-semibold text-gray-500 mb-2">Buy SMS Pack (₹0.37/SMS)</p>
          <div className="space-y-2">
            {plans.length > 0 ? plans.map((plan) => (
              <button
                key={plan.plan}
                onClick={() => handleBuyPlan(plan.plan, plan.label, plan.totalSMS)}
                disabled={buyingPlan === plan.plan}
                className="w-full flex items-center justify-between bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 hover:bg-orange-100 transition-colors disabled:opacity-60"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-orange-700">{plan.totalSMS} SMS Pack</p>
                  <p className="text-xs text-orange-500">Valid {plan.validityDays} days · ₹{plan.pricePerSMS}/SMS</p>
                </div>
                <div className="flex items-center gap-1.5 bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0">
                  {buyingPlan === plan.plan ? 'Opening...' : `₹${plan.price}`}
                </div>
              </button>
            )) : (
              // Fallback hardcoded plans if API not loaded yet
              [
                { plan: 'sms_100',  totalSMS: 100,  price: 37,  validityDays: 30,  pricePerSMS: 0.37 },
                { plan: 'sms_500',  totalSMS: 500,  price: 185, validityDays: 60,  pricePerSMS: 0.37 },
                { plan: 'sms_2000', totalSMS: 2000, price: 740, validityDays: 90,  pricePerSMS: 0.37 },
              ].map((plan) => (
                <button
                  key={plan.plan}
                  onClick={() => handleBuyPlan(plan.plan, `${plan.totalSMS} SMS Pack`, plan.totalSMS)}
                  disabled={buyingPlan === plan.plan}
                  className="w-full flex items-center justify-between bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 hover:bg-orange-100 transition-colors disabled:opacity-60"
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold text-orange-700">{plan.totalSMS} SMS Pack</p>
                    <p className="text-xs text-orange-500">Valid {plan.validityDays} days · ₹{plan.pricePerSMS}/SMS</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0">
                    {buyingPlan === plan.plan ? 'Opening...' : `₹${plan.price}`}
                  </div>
                </button>
              ))
            )}
          </div>

          <p className="text-xs text-gray-400 text-center mt-2">
            Pack credits used first, then wallet balance
          </p>
        </div>

        {/* UPI QR Code */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <QrCode size={18} className="text-brand-500" />
              <h2 className="font-semibold text-gray-800">Payment QR Code</h2>
            </div>
          </div>
          {user?.upiId ? (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                UPI: <span className="font-mono font-medium text-gray-700">{user.upiId}</span>
              </p>
              <button
                onClick={handleDownloadQR}
                disabled={qrLoading}
                className="flex items-center gap-2 bg-brand-50 text-brand-600 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-brand-100 transition-colors disabled:opacity-50"
              >
                <Download size={15} />
                {qrLoading ? 'Generating...' : 'Download QR Code'}
              </button>
              <p className="text-xs text-gray-400 mt-2">Share this QR at your shop for easy payments</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-2">Add your UPI ID in the profile above to generate a payment QR code for your shop.</p>
              <button onClick={() => setEditing(true)} className="text-xs font-semibold text-brand-500 hover:underline">
                Edit Profile → Add UPI ID
              </button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={18} className="text-orange-500" />
            <h2 className="font-semibold text-gray-800">Push Notifications</h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            {user?.fcmToken
              ? 'Push notifications are enabled on this device.'
              : 'Enable to get payment alerts instantly on your device.'}
          </p>
          {!user?.fcmToken ? (
            <button
              onClick={handleEnablePush}
              disabled={enablingPush}
              className="w-full bg-orange-50 text-orange-600 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors disabled:opacity-50"
            >
              {enablingPush ? (
                <>
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-orange-300 border-t-orange-600" />
                  Enabling...
                </>
              ) : (
                <>
                  <Bell size={15} />
                  Enable Notifications
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Notifications active on this device
            </div>
          )}
        </div>

        {/* Quick Navigate — visible on mobile (pages not in bottom nav) */}
        <div className="card md:hidden">
          <div className="flex items-center gap-2 mb-3">
            <Package size={18} className="text-purple-500" />
            <h2 className="font-semibold text-gray-800">Manage</h2>
          </div>
          <div className="space-y-1">
            {[
              { icon: Package, label: 'Inventory', to: '/inventory', color: 'text-purple-500' },
              { icon: Truck, label: 'Suppliers', to: '/suppliers', color: 'text-orange-500' },
              { icon: TrendingDown, label: 'Expenses', to: '/expenses', color: 'text-red-500' },
              { icon: FileText, label: 'Invoices', to: '/invoices', color: 'text-green-500' },
              { icon: Trophy, label: 'Customer Leaderboard', to: '/leaderboard', color: 'text-yellow-500' },
              { icon: Bell, label: 'Auto Reminders', to: '/scheduled-reminders', color: 'text-brand-500' },
              { icon: Briefcase, label: 'PagarKhata (Payroll)', to: '/pagar-khata', color: 'text-blue-500' },
            ].map(({ icon: Icon, label, to, color }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="w-full flex items-center justify-between py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={16} className={color} />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>
        </div>

        {/* Reports & Tools */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-green-500" />
            <h2 className="font-semibold text-gray-800">Reports & Tools</h2>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => navigate('/payout-settings')}
              className="w-full flex items-center justify-between py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <Wallet size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Payout Account</span>
              </div>
              <div className="flex items-center gap-2">
                {payoutAccount?.razorpayAccountStatus === 'active' && (
                  <span className="text-xs font-semibold text-green-600">Active</span>
                )}
                {(!payoutAccount || payoutAccount.razorpayAccountStatus === 'not_connected') && (
                  <span className="text-xs font-semibold text-orange-500">Setup</span>
                )}
                {(payoutAccount?.razorpayAccountStatus === 'created' || payoutAccount?.razorpayAccountStatus === 'kyc_pending') && (
                  <span className="text-xs font-semibold text-orange-500">KYC Pending</span>
                )}
                {payoutAccount?.razorpayAccountStatus === 'suspended' && (
                  <span className="text-xs font-semibold text-red-500">Suspended</span>
                )}
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="w-full flex items-center justify-between py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <TrendingUp size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Business Reports</span>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
            <button
              onClick={() => navigate('/reminders')}
              className="w-full flex items-center justify-between py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <Clock size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Reminder History</span>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          </div>
        </div>

        {/* Security */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Lock size={18} className="text-indigo-500" />
            <h2 className="font-semibold text-gray-800">Security</h2>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <Lock size={16} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">App PIN Lock</p>
                <p className="text-xs text-gray-400">{isPinEnabled ? 'PIN enabled — app locks when minimized' : 'Auto-lock when you switch apps'}</p>
              </div>
            </div>
            {isPinEnabled ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPinSetup(true)} className="text-xs text-indigo-600 font-medium">Change</button>
                <button onClick={() => { disablePin(); toast.success('PIN disabled'); }} className="text-xs text-red-500 font-medium">Remove</button>
              </div>
            ) : (
              <button onClick={() => setShowPinSetup(true)} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg font-medium">Enable</button>
            )}
          </div>
        </div>

        {/* Language */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🌐</span>
              <div>
                <p className="font-medium text-gray-800">Language / भाषा</p>
                <p className="text-xs text-gray-400">App display language</p>
              </div>
            </div>
            <div className="flex gap-2">
              {[{ code: 'en', label: 'EN' }, { code: 'hi', label: 'हि' }].map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => { i18n.changeLanguage(code); localStorage.setItem('udhaari-lang', code); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                    i18n.language === code ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Team */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Users size={18} className="text-blue-500" />
            <h2 className="font-semibold text-gray-800">Team & Business</h2>
          </div>
          <div className="space-y-1">
            {[
              { icon: Users, label: 'Staff Management', to: '/staff', color: 'text-blue-500' },
              { icon: CreditCard, label: 'Digital Business Card', to: '/business-card', color: 'text-purple-500' },
              { icon: Building2, label: 'My Businesses', to: '/businesses', color: 'text-teal-500' },
            ].map(({ icon: Icon, label, to, color }) => (
              <button key={to} onClick={() => navigate(to)} className="w-full flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <Icon size={16} className={color} />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>
        </div>

        {/* About */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={18} className="text-gray-400" />
            <h2 className="font-semibold text-gray-800">About</h2>
          </div>
          <InfoRow label="App" value="UdhaariBook" />
          <InfoRow label="Version" value="1.0.0" />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between bg-white border border-red-100 rounded-2xl px-4 py-3.5 hover:bg-red-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <LogOut size={18} className="text-red-500" />
            <span className="font-semibold text-red-600">Logout</span>
          </div>
          <ChevronRight size={16} className="text-red-300" />
        </button>
      </div>
      {/* ── PIN Setup Modal ─────────────────────────────────────────── */}
      {showPinSetup && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold">{isPinEnabled ? 'Change PIN' : 'Set PIN Lock'}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New 4-digit PIN</label>
              <input type="password" inputMode="numeric" maxLength={4} value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm PIN</label>
              <input type="password" inputMode="numeric" maxLength={4} value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••" />
            </div>
            {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowPinSetup(false); setPinInput(''); setPinConfirm(''); setPinError(''); }}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium">Cancel</button>
              <button onClick={handleSavePin}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium">Save PIN</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top-up Modal ─────────────────────────────────────────────── */}
      <Modal open={showTopUp} onClose={() => setShowTopUp(false)} title="Add Money to Wallet">
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Minimum ₹20 · ₹0.40 per SMS (without pack)</p>

          {/* Preset amounts */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Amount</label>
            <div className="flex flex-wrap gap-2">
              {TOPUP_PRESETS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setTopUpAmount(amt); setCustomAmount(''); }}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    topUpAmount === amt && !customAmount
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-brand-300'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Or enter custom amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="e.g. 150"
                min={20}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="input-field pl-9"
              />
            </div>
          </div>

          {/* What you get */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
            ₹{customAmount || topUpAmount} = <strong>{Math.floor((parseFloat(customAmount || String(topUpAmount)) || 0) / 0.40)} SMS</strong> reminders (without pack)
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowTopUp(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleTopUp}
              disabled={payingTopUp}
              className="btn-primary flex-1"
            >
              {payingTopUp ? 'Opening...' : `Pay ₹${customAmount || topUpAmount}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-1.5 gap-4">
      <span className="text-xs font-medium text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-700 text-right">{value}</span>
    </div>
  );
}
