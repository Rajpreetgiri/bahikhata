import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Link, Plus, Minus, Trash2, MoreVertical, Phone, Mail, AlertTriangle, ChevronDown, FileText, Image, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api, { getApiErrorMessage } from '../lib/api';
import { Customer, Transaction, Payment, Invoice } from '../types';
import TransactionModal from '../components/features/TransactionModal';
import ReminderSheet from '../components/features/ReminderSheet';
import PaymentLinkCard from '../components/features/PaymentLinkCard';
import InvoiceCard from '../components/features/InvoiceCard';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import { useTransactionStore } from '../store/transactionStore';
import { useCustomerStore } from '../store/customerStore';

type Tab = 'ledger' | 'payments' | 'invoices';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { deleteTransaction, addTransaction } = useTransactionStore();
  const { updateCustomer, deleteCustomer } = useCustomerStore();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txHasMore, setTxHasMore] = useState(false);
  const [txLoadingMore, setTxLoadingMore] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('ledger');
  const [togglingRisk, setTogglingRisk] = useState(false);

  const [showTxModal, setShowTxModal] = useState(false);
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [sharingStatement, setSharingStatement] = useState(false);
  const [txType, setTxType] = useState<'gave' | 'got'>('gave');
  const [showReminder, setShowReminder] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', creditLimit: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [txToDelete, setTxToDelete] = useState<{ id: string; amount: number } | null>(null);

  // Opening balance quick-entry state
  const [obAmount, setObAmount] = useState('');
  const [obType, setObType] = useState<'gave' | 'got'>('gave');
  const [obSaving, setObSaving] = useState(false);
  const obInputRef = useRef<HTMLInputElement>(null);

  const TX_LIMIT = 30;

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [custRes, txRes, payRes, invRes] = await Promise.all([
        api.get<{ customer: Customer; transactions: Transaction[] }>(`/api/customers/${id}`),
        api.get<Transaction[]>(`/api/transactions/customer/${id}?page=1&limit=${TX_LIMIT}`),
        api.get<Payment[]>(`/api/payments/${id}`),
        api.get<{ data: Invoice[]; meta: unknown }>(`/api/invoices?customerId=${id}`),
      ]);
      setCustomer(custRes.data.customer);
      setTransactions(txRes.data);
      setTxPage(1);
      setTxHasMore(txRes.data.length === TX_LIMIT);
      setPayments(payRes.data);
      setInvoices(invRes.data.data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load customer'));
      navigate('/customers');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreTransactions = async () => {
    if (!id || txLoadingMore || !txHasMore) return;
    setTxLoadingMore(true);
    try {
      const nextPage = txPage + 1;
      const res = await api.get<Transaction[]>(`/api/transactions/customer/${id}?page=${nextPage}&limit=${TX_LIMIT}`);
      setTransactions((prev) => [...prev, ...res.data]);
      setTxPage(nextPage);
      setTxHasMore(res.data.length === TX_LIMIT);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load more'));
    } finally {
      setTxLoadingMore(false);
    }
  };

  const handleToggleRiskFlag = async () => {
    if (!customer) return;
    setTogglingRisk(true);
    try {
      const res = await api.patch<Customer>(`/api/customers/${customer._id}/risk-flag`, {
        riskFlag: !customer.riskFlag,
      });
      setCustomer(res.data);
      toast.success(res.data.riskFlag ? 'Marked as risky' : 'Risk flag removed');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update risk flag'));
    } finally {
      setTogglingRisk(false);
      setShowMenu(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleDeleteTx = async (txId: string) => {
    if (!customer) return;
    try {
      await deleteTransaction(txId, customer._id);
      setTransactions((prev) => prev.filter((t) => t._id !== txId));
      const res = await api.get<{ customer: Customer; transactions: Transaction[] }>(`/api/customers/${id}`);
      setCustomer(res.data.customer);
      toast.success('Transaction deleted');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete transaction'));
    }
  };

  const handleEditSave = async () => {
    if (!customer) return;
    try {
      const payload = {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        creditLimit: editForm.creditLimit ? parseFloat(editForm.creditLimit) : 0,
      };
      await updateCustomer(customer._id, payload);
      setCustomer({ ...customer, ...payload, creditLimit: payload.creditLimit || undefined });
      setShowEditModal(false);
      toast.success('Customer updated');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update customer'));
    }
  };

  const handleDelete = async () => {
    if (!customer) return;
    try {
      await deleteCustomer(customer._id);
      toast.success('Customer deleted');
      navigate('/customers');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete customer'));
    }
  };

  const openEdit = () => {
    if (!customer) return;
    setEditForm({
      name: customer.name,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      creditLimit: customer.creditLimit ? String(customer.creditLimit) : '',
    });
    setShowEditModal(true);
    setShowMenu(false);
  };

  const handleShareStatement = async () => {
    if (!customer) return;
    setSharingStatement(true);
    try {
      const res = await api.get(`/api/reports/customer/${customer._id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      const fileName = `${customer.name.replace(/\s+/g, '_')}_statement.pdf`;
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `${customer.name} - Statement` });
          return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to get statement'));
    } finally {
      setSharingStatement(false);
    }
  };

  // Save opening balance (direct quick entry — no product/invoice needed)
  const handleSaveOpeningBalance = async () => {
    const amount = parseFloat(obAmount);
    if (!amount || amount <= 0) { toast.error('Amount daalo'); obInputRef.current?.focus(); return; }
    if (!customer) return;
    setObSaving(true);
    try {
      await addTransaction({
        customerId: customer._id,
        type: obType,
        amount,
        note: 'Opening Balance (Purani Udhari)',
      });
      setObAmount('');
      toast.success(obType === 'gave'
        ? `₹${amount.toLocaleString('en-IN')} ki purani udhari record hui`
        : `₹${amount.toLocaleString('en-IN')} ki purani payment record hui`
      );
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save'));
    } finally {
      setObSaving(false);
    }
  };

  // Compute running balance for visible transactions (newest-first list → reverse to get oldest-first)
  const computeRunningBalances = (txList: Transaction[]): number[] => {
    // txList is newest-first; we need oldest-first for running balance
    const reversed = [...txList].reverse();
    const balances: number[] = [];
    let running = 0;
    for (const tx of reversed) {
      running = tx.type === 'gave' ? running + tx.amount : running - tx.amount;
      balances.push(running);
    }
    // Return in original order (newest first)
    return balances.reverse();
  };

  const runningBalances = computeRunningBalances(transactions);

  const latestPaymentLink = payments.find((p) => p.status === 'pending')?.razorpayPaymentLinkUrl;

  if (isLoading) return <div className="flex justify-center items-center h-full py-20"><Spinner size={36} /></div>;
  if (!customer) return null;

  const hasDebt = customer.totalOutstanding > 0;

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className={`px-4 pt-12 pb-5 ${hasDebt ? 'bg-red-500' : customer.totalOutstanding < 0 ? 'bg-green-500' : 'bg-gray-700'}`}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="text-white/80"><ArrowLeft size={22} /></button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="text-white/80 p-1"><MoreVertical size={22} /></button>
            {showMenu && (
              <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-gray-100 min-w-[160px] z-10">
                <button onClick={openEdit} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">Edit</button>
                <button onClick={handleToggleRiskFlag} disabled={togglingRisk} className="w-full text-left px-4 py-3 text-sm text-orange-600 hover:bg-orange-50">
                  {customer?.riskFlag ? 'Remove Risk Flag' : 'Mark as Risky'}
                </button>
                <button onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50">Delete</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-white text-xl font-bold">{customer.name}</h1>
              {customer.riskFlag && (
                <span className="flex items-center gap-1 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  <AlertTriangle size={10} /> Risky
                </span>
              )}
            </div>
            <div className="flex gap-3 mt-0.5 flex-wrap">
              {customer.phone && <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-white/70 text-xs"><Phone size={11} />{customer.phone}</a>}
              {customer.email && <span className="flex items-center gap-1 text-white/70 text-xs"><Mail size={11} />{customer.email}</span>}
              {customer.creditLimit ? <span className="text-white/60 text-xs">Limit: ₹{customer.creditLimit.toLocaleString('en-IN')}</span> : null}
            </div>
          </div>
        </div>

        <div className="mt-4 bg-white/20 rounded-2xl px-4 py-3 flex justify-between items-center">
          <div>
            <p className="text-white/70 text-xs">
              {hasDebt ? 'Tumhe dena hai (Udhari)' : customer.totalOutstanding < 0 ? 'Tumhara dena hai' : 'Settled — Koi baki nahi'}
            </p>
            <p className="text-white text-2xl font-bold">
              ₹{Math.abs(customer.totalOutstanding).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={() => setShowReminder(true)} className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors">
              <Bell size={14} />Remind
            </button>
            <button onClick={() => { setActiveTab('payments'); setShowPayments(true); }} className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors">
              <Link size={14} />Pay Link
            </button>
            <button onClick={handleShareStatement} disabled={sharingStatement} className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50">
              <FileText size={14} />{sharingStatement ? '...' : 'Statement'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100">
        {(['ledger', 'payments', 'invoices'] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${activeTab === tab ? 'text-brand-500 border-b-2 border-brand-500' : 'text-gray-400'}`}
          >
            {tab}
            {tab === 'invoices' && invoices.filter((i) => i.status === 'unpaid').length > 0 && (
              <span className="ml-1 text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
                {invoices.filter((i) => i.status === 'unpaid').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {activeTab === 'ledger' ? (
          <div>
            {/* Opening Balance Quick Entry — shown when no transactions exist */}
            {transactions.length === 0 && (
              <div className="mx-4 mt-4 mb-2 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <IndianRupee size={16} className="text-amber-600" />
                  <p className="text-sm font-semibold text-amber-800">Purani Udhari Daalein</p>
                </div>
                <p className="text-xs text-amber-600 mb-3">
                  Agar is customer ki pehle se koi udhari ya payment pending hai, toh woh yahan record karo.
                </p>

                {/* Type toggle */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setObType('gave')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${obType === 'gave' ? 'bg-red-500 text-white' : 'bg-white text-red-500 border border-red-200'}`}
                  >
                    Customer mujhe dega (Udhari)
                  </button>
                  <button
                    onClick={() => setObType('got')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${obType === 'got' ? 'bg-green-500 text-white' : 'bg-white text-green-500 border border-green-200'}`}
                  >
                    Maine usse lena hai (Advance)
                  </button>
                </div>

                {/* Amount input + save */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                    <input
                      ref={obInputRef}
                      type="number"
                      inputMode="decimal"
                      placeholder="Amount daalo"
                      value={obAmount}
                      onChange={(e) => setObAmount(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveOpeningBalance()}
                      className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    />
                  </div>
                  <button
                    onClick={handleSaveOpeningBalance}
                    disabled={obSaving || !obAmount}
                    className="bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
                  >
                    {obSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {/* Direct udhari hint — shown above existing transactions */}
            {transactions.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <p className="text-[11px] text-gray-400 font-medium">
                  Neeche ke buttons se directly amount daal sakte ho — bina kisi product ke
                </p>
              </div>
            )}

            {/* Transaction list with running balance */}
            {transactions.length === 0 ? null : (
              <>
                {transactions.map((tx, idx) => {
                  const isOverdue = tx.dueDate && tx.type === 'gave' && new Date(tx.dueDate) < new Date();
                  const isDueSoon = tx.dueDate && tx.type === 'gave' && !isOverdue && new Date(tx.dueDate) <= new Date(Date.now() + 3 * 86400000);
                  const runBal = runningBalances[idx];
                  return (
                    <div key={tx._id} className="flex items-start gap-3 px-4 py-3.5 bg-white border-b border-gray-50">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${tx.type === 'gave' ? 'bg-red-100' : 'bg-green-100'}`}>
                        {tx.type === 'gave' ? <Minus size={16} className="text-red-500" /> : <Plus size={16} className="text-green-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${tx.type === 'gave' ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.type === 'gave' ? '− ' : '+ '}₹{tx.amount.toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {tx.note ?? (tx.type === 'gave' ? 'Diya (Udhari)' : 'Liya (Payment)')}
                          {tx.paymentMethod && <span className="ml-1 text-gray-300">• {tx.paymentMethod.replace('_', ' ')}</span>}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {tx.dueDate && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-red-600' : isDueSoon ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                              {isOverdue ? 'Overdue' : 'Due'}: {format(new Date(tx.dueDate), 'd MMM yy')}
                            </span>
                          )}
                          {tx.photoUrl && (
                            <button onClick={() => setPhotoModal(`${import.meta.env.VITE_API_URL ?? 'http://localhost:5000'}${tx.photoUrl}`)}
                              className="flex items-center gap-1 text-[10px] text-brand-500 font-semibold">
                              <Image size={11} />Photo
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-400">{format(new Date(tx.createdAt), 'd MMM yy')}</p>
                        {/* Running balance after this transaction */}
                        <p className={`text-[10px] font-semibold mt-0.5 ${runBal > 0 ? 'text-red-500' : runBal < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          Bal: ₹{Math.abs(runBal).toLocaleString('en-IN')}
                          {runBal > 0 ? ' ↑' : runBal < 0 ? ' ↓' : ''}
                        </p>
                        <button onClick={() => setTxToDelete({ id: tx._id, amount: tx.amount })} className="mt-1 text-gray-200 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {txHasMore && (
                  <div className="py-4 flex justify-center">
                    <button onClick={loadMoreTransactions} disabled={txLoadingMore}
                      className="flex items-center gap-2 text-sm text-brand-600 font-semibold px-4 py-2 rounded-xl hover:bg-brand-50 disabled:opacity-50">
                      {txLoadingMore ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" /> : <ChevronDown size={16} />}
                      {txLoadingMore ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === 'invoices' ? (
          <div>
            <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
              <p className="text-xs text-gray-500 font-medium">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
              <button onClick={() => navigate(`/invoices/create?customerId=${id}`)}
                className="flex items-center gap-1.5 bg-brand-50 text-brand-600 px-3 py-1.5 rounded-xl text-xs font-semibold">
                <Plus size={13} />New Invoice
              </button>
            </div>
            {invoices.length === 0 ? (
              <div className="text-center py-12 text-gray-400"><p className="text-sm">No invoices yet</p></div>
            ) : (
              invoices.map((inv) => (
                <InvoiceCard key={inv._id} invoice={inv} customerName={customer.name} onClick={() => navigate(`/invoices/${inv._id}`)} />
              ))
            )}
          </div>
        ) : (
          <div className="p-4">
            <PaymentLinkCard customer={customer} payments={payments} onPaymentCreated={(p) => setPayments([p, ...payments])} />
          </div>
        )}
      </div>

      {/* Bottom action buttons */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        <button onClick={() => { setTxType('gave'); setShowTxModal(true); }}
          className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
          <Minus size={18} />Diya (Gave)
        </button>
        <button onClick={() => { setTxType('got'); setShowTxModal(true); }}
          className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
          <Plus size={18} />Liya (Got)
        </button>
      </div>

      {/* Modals */}
      <TransactionModal
        open={showTxModal}
        onClose={() => setShowTxModal(false)}
        customerId={customer._id}
        customerName={customer.name}
        defaultType={txType}
        onSuccess={load}
        currentOutstanding={customer.totalOutstanding}
        creditLimit={customer.creditLimit}
      />
      {showReminder && (
        <ReminderSheet open={showReminder} onClose={() => setShowReminder(false)} customer={customer} paymentLink={latestPaymentLink} />
      )}

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Customer">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} type="tel" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} type="email" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Credit Limit (₹, optional)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
              <input value={editForm.creditLimit} onChange={(e) => setEditForm({ ...editForm, creditLimit: e.target.value })} type="number" min="0" placeholder="No limit" className="input-field pl-8" />
            </div>
            <p className="text-xs text-gray-400 mt-1">Max credit allowed. Leave blank for no limit.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowEditModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleEditSave} className="btn-primary">Save</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!txToDelete} onClose={() => setTxToDelete(null)} title="Transaction Delete Karein?">
        <p className="text-gray-500 text-sm mb-5">
          Ye <strong>₹{txToDelete?.amount.toLocaleString('en-IN')}</strong> wali entry delete hogi aur balance reverse ho jayega. Undo nahi hoga.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setTxToDelete(null)} className="btn-secondary">Cancel</button>
          <button onClick={async () => { if (!txToDelete) return; await handleDeleteTx(txToDelete.id); setTxToDelete(null); }}
            className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold">Delete</button>
        </div>
      </Modal>

      {photoModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPhotoModal(null)}>
          <img src={photoModal} alt="proof" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}

      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Customer Delete Karein?">
        <p className="text-gray-500 text-sm mb-5">
          <strong>{customer.name}</strong> aur unki poori transaction history hamesha ke liye delete ho jayegi.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
