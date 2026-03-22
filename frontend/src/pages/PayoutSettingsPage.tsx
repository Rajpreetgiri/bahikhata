import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Wallet, CheckCircle, Clock, XCircle, AlertTriangle,
  RefreshCw, Unlink, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { getApiErrorMessage } from '../lib/api';
import { usePayoutStore } from '../store/payoutStore';
import { PayoutAccountStatus, RouteTransfer } from '../types';
import Spinner from '../components/ui/Spinner';
import PageHeader from '../components/layout/PageHeader';

// ── Indian States ──────────────────────────────────────────────────────────────
const INDIAN_STATES = [
  ['AN', 'Andaman and Nicobar Islands'], ['AP', 'Andhra Pradesh'], ['AR', 'Arunachal Pradesh'],
  ['AS', 'Assam'], ['BR', 'Bihar'], ['CH', 'Chandigarh'], ['CT', 'Chhattisgarh'],
  ['DN', 'Dadra and Nagar Haveli'], ['DD', 'Daman and Diu'], ['DL', 'Delhi'],
  ['GA', 'Goa'], ['GJ', 'Gujarat'], ['HR', 'Haryana'], ['HP', 'Himachal Pradesh'],
  ['JK', 'Jammu and Kashmir'], ['JH', 'Jharkhand'], ['KA', 'Karnataka'], ['KL', 'Kerala'],
  ['LA', 'Ladakh'], ['LD', 'Lakshadweep'], ['MP', 'Madhya Pradesh'], ['MH', 'Maharashtra'],
  ['MN', 'Manipur'], ['ML', 'Meghalaya'], ['MZ', 'Mizoram'], ['NL', 'Nagaland'],
  ['OR', 'Odisha'], ['PY', 'Puducherry'], ['PB', 'Punjab'], ['RJ', 'Rajasthan'],
  ['SK', 'Sikkim'], ['TN', 'Tamil Nadu'], ['TG', 'Telangana'], ['TR', 'Tripura'],
  ['UP', 'Uttar Pradesh'], ['UT', 'Uttarakhand'], ['WB', 'West Bengal'],
];

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<PayoutAccountStatus, { label: string; color: string; bg: string; Icon: typeof CheckCircle }> = {
  not_connected: { label: 'Not Connected', color: 'text-gray-500', bg: 'bg-gray-100', Icon: Wallet },
  created:       { label: 'KYC Pending',   color: 'text-orange-600', bg: 'bg-orange-100', Icon: Clock },
  kyc_pending:   { label: 'KYC Pending',   color: 'text-orange-600', bg: 'bg-orange-100', Icon: Clock },
  active:        { label: 'Active',         color: 'text-green-600',  bg: 'bg-green-100',  Icon: CheckCircle },
  suspended:     { label: 'Suspended',      color: 'text-red-600',    bg: 'bg-red-100',    Icon: AlertTriangle },
};

// ── Transfer status badge ──────────────────────────────────────────────────────
function TransferStatusBadge({ status }: { status: RouteTransfer['status'] }) {
  if (status === 'settled')  return <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle size={11} /> Settled</span>;
  if (status === 'initiated') return <span className="flex items-center gap-1 text-orange-500 text-xs font-medium"><Clock size={11} /> Pending</span>;
  if (status === 'reversed')  return <span className="flex items-center gap-1 text-blue-500 text-xs font-medium"><RefreshCw size={11} /> Reversed</span>;
  return <span className="flex items-center gap-1 text-red-500 text-xs font-medium"><XCircle size={11} /> Failed</span>;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PayoutSettingsPage() {
  const navigate = useNavigate();
  const { account, transfers, isLoading, transfersLoading, loadAccount, connectAccount,
          updateUpi, updateBank, syncStatus, loadTransfers, disconnectAccount } = usePayoutStore();

  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [editUpi, setEditUpi] = useState(false);
  const [editBank, setEditBank] = useState(false);
  const [upiValue, setUpiValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Connect form state
  const [form, setForm] = useState({
    legalBusinessName: '', pan: '', city: '', state: '', postalCode: '',
    bankAccountName: '', bankAccountNumber: '', bankConfirm: '', bankIfsc: '', bankName: '',
    upiId: '',
  });
  const [connecting, setConnecting] = useState(false);

  // Bank edit form
  const [bankForm, setBankForm] = useState({
    bankAccountName: '', bankAccountNumber: '', bankConfirm: '', bankIfsc: '', bankName: '',
  });

  useEffect(() => {
    loadAccount();
  }, []);

  useEffect(() => {
    if (account?.razorpayAccountStatus === 'active') {
      loadTransfers();
    }
  }, [account?.razorpayAccountStatus]);

  const setF = (key: keyof typeof form, value: string) => setForm((p) => ({ ...p, [key]: value }));
  const setBF = (key: keyof typeof bankForm, value: string) => setBankForm((p) => ({ ...p, [key]: value }));

  const handleConnect = async () => {
    if (!form.legalBusinessName.trim()) { toast.error('Legal business name required'); return; }
    if (!/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/.test(form.pan.trim())) { toast.error('Invalid PAN format'); return; }
    if (!form.city.trim() || !form.state || !form.postalCode.trim()) { toast.error('City, state and postal code required'); return; }
    if (!/^\d{6}$/.test(form.postalCode.trim())) { toast.error('Postal code must be 6 digits'); return; }
    if (form.bankAccountNumber && form.bankAccountNumber !== form.bankConfirm) {
      toast.error('Bank account numbers do not match'); return;
    }
    setConnecting(true);
    try {
      await connectAccount({
        legalBusinessName: form.legalBusinessName.trim(),
        pan: form.pan.trim().toUpperCase(),
        city: form.city.trim(),
        state: form.state,
        postalCode: form.postalCode.trim(),
        bankAccountName: form.bankAccountName.trim() || undefined,
        bankAccountNumber: form.bankAccountNumber.trim() || undefined,
        bankIfsc: form.bankIfsc.trim().toUpperCase() || undefined,
        bankName: form.bankName.trim() || undefined,
        upiId: form.upiId.trim().toLowerCase() || undefined,
      });
      toast.success('Payout account connected! Check your email for KYC link from Razorpay.');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to connect account'));
    } finally {
      setConnecting(false);
    }
  };

  const handleSyncStatus = async () => {
    setSyncing(true);
    try {
      await syncStatus();
      toast.success('Status synced!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to sync status'));
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your payout account? Future payments will not be auto-routed.')) return;
    setDisconnecting(true);
    try {
      await disconnectAccount();
      toast.success('Payout account disconnected');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to disconnect'));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleUpdateUpi = async () => {
    if (!upiValue.trim()) { toast.error('Enter UPI ID'); return; }
    setSaving(true);
    try {
      await updateUpi(upiValue.trim());
      toast.success('UPI ID updated!');
      setEditUpi(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update UPI ID'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBank = async () => {
    if (!bankForm.bankAccountName.trim()) { toast.error('Account holder name required'); return; }
    if (!bankForm.bankAccountNumber.trim()) { toast.error('Account number required'); return; }
    if (bankForm.bankAccountNumber !== bankForm.bankConfirm) { toast.error('Account numbers do not match'); return; }
    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/i.test(bankForm.bankIfsc.trim())) { toast.error('Invalid IFSC format'); return; }
    setSaving(true);
    try {
      await updateBank({
        bankAccountName: bankForm.bankAccountName.trim(),
        bankAccountNumber: bankForm.bankAccountNumber.trim(),
        bankIfsc: bankForm.bankIfsc.trim().toUpperCase(),
        bankName: bankForm.bankName.trim() || undefined,
      });
      toast.success('Bank account updated!');
      setEditBank(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update bank details'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={32} />
      </div>
    );
  }

  const status: PayoutAccountStatus = account?.razorpayAccountStatus ?? 'not_connected';
  const sc = STATUS_CONFIG[status];
  const { Icon: StatusIcon } = sc;

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Payout Account"
        onBack={() => navigate(-1)}
        right={
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${sc.bg} ${sc.color}`}>
            <StatusIcon size={13} />
            {sc.label}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 pb-10 space-y-4">

        {/* ── STATE A: Not Connected ── */}
        {status === 'not_connected' && (
          <>
            {/* How it works */}
            <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-brand-700 mb-2">How it works</p>
              <div className="flex flex-col gap-1.5 text-xs text-brand-600">
                <p>1. Customer pays via payment link → money comes to platform</p>
                <p>2. Platform automatically routes payment to your linked account</p>
                {account?.platformFeePercent ? (
                  <p className="font-medium">3. Platform deducts {account.platformFeePercent}% fee, rest goes to you</p>
                ) : (
                  <p>3. Full amount routes to your account (0% platform fee)</p>
                )}
              </div>
            </div>

            {/* Connect form */}
            <div className="card space-y-4">
              <p className="text-sm font-bold text-gray-800">Legal Information</p>
              <p className="text-xs text-gray-400 -mt-2">Required by Razorpay for KYC verification</p>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Legal Business / Owner Name *</label>
                <input value={form.legalBusinessName} onChange={(e) => setF('legalBusinessName', e.target.value)}
                  placeholder="e.g. Sharma General Store" className="input-field text-sm py-2.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">PAN Number *</label>
                <input value={form.pan} onChange={(e) => setF('pan', e.target.value.toUpperCase())}
                  placeholder="e.g. ABCDE1234F" maxLength={10} className="input-field text-sm py-2.5 font-mono tracking-widest" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">City *</label>
                  <input value={form.city} onChange={(e) => setF('city', e.target.value)}
                    placeholder="e.g. Mumbai" className="input-field text-sm py-2.5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Postal Code *</label>
                  <input value={form.postalCode} onChange={(e) => setF('postalCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="400001" inputMode="numeric" className="input-field text-sm py-2.5 font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">State *</label>
                <select value={form.state} onChange={(e) => setF('state', e.target.value)} className="input-field text-sm py-2.5">
                  <option value="">Select state...</option>
                  {INDIAN_STATES.map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="card space-y-4">
              <p className="text-sm font-bold text-gray-800">Bank Account</p>
              <p className="text-xs text-gray-400 -mt-2">Required by Razorpay to settle payments to you</p>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Account Holder Name</label>
                <input value={form.bankAccountName} onChange={(e) => setF('bankAccountName', e.target.value)}
                  placeholder="As per bank records" className="input-field text-sm py-2.5" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Account Number</label>
                <input value={form.bankAccountNumber} onChange={(e) => setF('bankAccountNumber', e.target.value.replace(/\D/g, ''))}
                  type="password" inputMode="numeric" placeholder="Enter account number" className="input-field text-sm py-2.5 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Confirm Account Number</label>
                <input value={form.bankConfirm} onChange={(e) => setF('bankConfirm', e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric" placeholder="Re-enter account number" className="input-field text-sm py-2.5 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">IFSC Code</label>
                  <input value={form.bankIfsc} onChange={(e) => setF('bankIfsc', e.target.value.toUpperCase())}
                    placeholder="SBIN0001234" maxLength={11} className="input-field text-sm py-2.5 font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Bank Name</label>
                  <input value={form.bankName} onChange={(e) => setF('bankName', e.target.value)}
                    placeholder="e.g. SBI" className="input-field text-sm py-2.5" />
                </div>
              </div>
            </div>

            <div className="card space-y-3">
              <p className="text-sm font-bold text-gray-800">UPI ID <span className="text-gray-400 font-normal text-xs">(optional)</span></p>
              <input value={form.upiId} onChange={(e) => setF('upiId', e.target.value.toLowerCase())}
                placeholder="e.g. yourname@okaxis" className="input-field text-sm py-2.5" />
            </div>

            <button onClick={handleConnect} disabled={connecting} className="btn-primary flex items-center justify-center gap-2">
              {connecting ? (
                <><div className="w-4 h-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Connecting...</>
              ) : (
                <><Wallet size={18} /> Connect Payout Account</>
              )}
            </button>
          </>
        )}

        {/* ── STATE B: Created / KYC Pending ── */}
        {(status === 'created' || status === 'kyc_pending') && (
          <>
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Clock size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-orange-800 text-sm mb-1">KYC Pending</p>
                  <p className="text-xs text-orange-700">
                    Razorpay ne aapke registered email pe ek verification link bheja hai.
                    Wahan jaake KYC complete karo taaki payments auto-route ho sakein.
                  </p>
                </div>
              </div>
            </div>

            {account?.razorpayAccountId && (
              <div className="card">
                <p className="text-xs font-medium text-gray-400 mb-1">Razorpay Account ID</p>
                <p className="font-mono text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-xl">{account.razorpayAccountId}</p>
              </div>
            )}

            <div className="card space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Details</p>
              {account?.legalBusinessName && <InfoRow label="Legal Name" value={account.legalBusinessName} />}
              {account?.pan && <InfoRow label="PAN" value={account.pan} mono />}
              {account?.bankAccountNumber && <InfoRow label="Bank Account" value={account.bankAccountNumber} mono />}
              {account?.bankIfsc && <InfoRow label="IFSC" value={account.bankIfsc} mono />}
              {account?.upiId && <InfoRow label="UPI ID" value={account.upiId} mono />}
            </div>

            <button onClick={handleSyncStatus} disabled={syncing}
              className="btn-secondary flex items-center justify-center gap-2">
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Status from Razorpay'}
            </button>

            <button onClick={handleDisconnect} disabled={disconnecting}
              className="w-full text-red-500 text-sm font-medium py-2 hover:text-red-700">
              {disconnecting ? 'Disconnecting...' : 'Disconnect Account'}
            </button>
          </>
        )}

        {/* ── STATE C: Active ── */}
        {status === 'active' && (
          <>
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800 text-sm">Account Active</p>
                  <p className="text-xs text-green-700">
                    Payments will automatically route to your account after {account?.platformFeePercent ?? 0}% platform fee.
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card text-center">
                <p className="text-xs text-gray-400 mb-1">Total Routed</p>
                <p className="text-xl font-bold text-gray-800">₹{(account?.totalAmountRouted ?? 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="card text-center">
                <p className="text-xs text-gray-400 mb-1">Transfers</p>
                <p className="text-xl font-bold text-gray-800">{account?.totalRouteTransfers ?? 0}</p>
              </div>
            </div>

            {/* Bank details */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bank Account</p>
                <button onClick={() => { setEditBank(!editBank); setBankForm({ bankAccountName: account?.bankAccountName ?? '', bankAccountNumber: '', bankConfirm: '', bankIfsc: account?.bankIfsc ?? '', bankName: account?.bankName ?? '' }); }}
                  className="text-brand-500 text-xs font-semibold flex items-center gap-1">
                  <Pencil size={12} /> Edit
                </button>
              </div>
              {!editBank ? (
                <div className="space-y-1">
                  {account?.bankAccountName && <InfoRow label="Holder" value={account.bankAccountName} />}
                  {account?.bankAccountNumber && <InfoRow label="Account" value={account.bankAccountNumber} mono />}
                  {account?.bankIfsc && <InfoRow label="IFSC" value={account.bankIfsc} mono />}
                  {account?.bankName && <InfoRow label="Bank" value={account.bankName} />}
                  {!account?.bankAccountNumber && (
                    <p className="text-xs text-orange-500">No bank account added. Add one for Razorpay settlement.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Account Holder Name</label>
                    <input value={bankForm.bankAccountName} onChange={(e) => setBF('bankAccountName', e.target.value)} className="input-field text-sm py-2.5" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">New Account Number</label>
                    <input value={bankForm.bankAccountNumber} onChange={(e) => setBF('bankAccountNumber', e.target.value.replace(/\D/g, ''))} type="password" inputMode="numeric" className="input-field text-sm py-2.5 font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Confirm Account Number</label>
                    <input value={bankForm.bankConfirm} onChange={(e) => setBF('bankConfirm', e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="input-field text-sm py-2.5 font-mono" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">IFSC</label>
                      <input value={bankForm.bankIfsc} onChange={(e) => setBF('bankIfsc', e.target.value.toUpperCase())} className="input-field text-sm py-2.5 font-mono" maxLength={11} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Bank Name</label>
                      <input value={bankForm.bankName} onChange={(e) => setBF('bankName', e.target.value)} className="input-field text-sm py-2.5" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditBank(false)} className="btn-secondary text-sm py-2">Cancel</button>
                    <button onClick={handleUpdateBank} disabled={saving} className="btn-primary text-sm py-2">{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                </div>
              )}
            </div>

            {/* UPI */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">UPI ID</p>
                <button onClick={() => { setEditUpi(!editUpi); setUpiValue(account?.upiId ?? ''); }}
                  className="text-brand-500 text-xs font-semibold flex items-center gap-1">
                  <Pencil size={12} /> {account?.upiId ? 'Edit' : 'Add'}
                </button>
              </div>
              {!editUpi ? (
                account?.upiId
                  ? <p className="text-sm font-mono text-gray-700">{account.upiId}</p>
                  : <p className="text-xs text-gray-400">No UPI ID added</p>
              ) : (
                <div className="space-y-3">
                  <input value={upiValue} onChange={(e) => setUpiValue(e.target.value.toLowerCase())} placeholder="yourname@okaxis" className="input-field text-sm py-2.5 font-mono" />
                  <div className="flex gap-2">
                    <button onClick={() => setEditUpi(false)} className="btn-secondary text-sm py-2">Cancel</button>
                    <button onClick={handleUpdateUpi} disabled={saving} className="btn-primary text-sm py-2">{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                </div>
              )}
            </div>

            {/* Platform fee info */}
            <div className="card">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Platform Fee</p>
              <p className="text-sm text-gray-700">
                <strong>{account?.platformFeePercent ?? 0}%</strong> deducted per payment before routing to your account.
              </p>
            </div>

            {/* Transfer history */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Transfer History</p>
              {transfersLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : transfers.length === 0 ? (
                <div className="card text-center py-8 text-gray-400 text-sm">No transfers yet</div>
              ) : (
                <div className="card overflow-hidden p-0">
                  {transfers.map((t, i) => (
                    <div key={t._id} className={`flex items-center gap-3 px-4 py-3.5 ${i < transfers.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-gray-800">
                            ₹{t.netAmountRs.toLocaleString('en-IN')}
                          </p>
                          <TransferStatusBadge status={t.status} />
                        </div>
                        <p className="text-xs text-gray-400">
                          Gross ₹{t.grossAmountRs} · Fee ₹{t.platformFeeRs}
                          {t.errorMessage && <span className="text-red-400 ml-1">· {t.errorMessage}</span>}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 flex-shrink-0">
                        {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sync + Disconnect */}
            <button onClick={handleSyncStatus} disabled={syncing}
              className="btn-secondary flex items-center justify-center gap-2 text-sm py-2.5">
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Account Status'}
            </button>

            <button onClick={handleDisconnect} disabled={disconnecting}
              className="w-full flex items-center justify-center gap-2 text-red-500 text-sm font-medium py-2 hover:text-red-700">
              <Unlink size={14} />
              {disconnecting ? 'Disconnecting...' : 'Disconnect Account'}
            </button>
          </>
        )}

        {/* ── STATE D: Suspended ── */}
        {status === 'suspended' && (
          <>
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 text-sm mb-1">Account Suspended</p>
                  <p className="text-xs text-red-700">
                    Your Razorpay linked account has been suspended. Please contact Razorpay support to resolve this.
                    Payments will NOT be auto-routed until the account is reactivated.
                  </p>
                </div>
              </div>
            </div>
            {account?.razorpayAccountId && (
              <div className="card">
                <p className="text-xs font-medium text-gray-400 mb-1">Razorpay Account ID</p>
                <p className="font-mono text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-xl">{account.razorpayAccountId}</p>
              </div>
            )}
            <button onClick={handleSyncStatus} disabled={syncing}
              className="btn-primary flex items-center justify-center gap-2">
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Status from Razorpay'}
            </button>
            <button onClick={handleDisconnect} disabled={disconnecting}
              className="w-full text-red-500 text-sm font-medium py-2 hover:text-red-700">
              {disconnecting ? 'Disconnecting...' : 'Disconnect Account'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-xs font-medium text-gray-400 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium text-gray-700 text-right ml-4 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

