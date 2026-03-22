import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, MoreVertical, Phone, Mail, Building2, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api, { getApiErrorMessage } from '../lib/api';
import { Supplier, SupplierTransaction } from '../types';
import SupplierTransactionModal from '../components/features/SupplierTransactionModal';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import { useSupplierTransactionStore } from '../store/supplierTransactionStore';
import { useSupplierStore } from '../store/supplierStore';

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addTransaction, deleteTransaction } = useSupplierTransactionStore();
  const { updateSupplier, deleteSupplier } = useSupplierStore();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState<'bought' | 'paid'>('bought');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', companyName: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [txToDelete, setTxToDelete] = useState<{ id: string; amount: number } | null>(null);

  // Opening balance (Purani Udhari) quick-entry state
  const [obType, setObType] = useState<'bought' | 'paid'>('bought');
  const [obAmount, setObAmount] = useState('');
  const [obSaving, setObSaving] = useState(false);
  const obInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await api.get<{ supplier: Supplier; transactions: SupplierTransaction[] }>(
        `/api/suppliers/${id}`
      );
      setSupplier(res.data.supplier);
      setTransactions(res.data.transactions);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load supplier'));
      navigate('/suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleDeleteTx = async (txId: string) => {
    if (!supplier) return;
    try {
      await deleteTransaction(txId);
      setTransactions((prev) => prev.filter((t) => t._id !== txId));
      const res = await api.get<{ supplier: Supplier; transactions: SupplierTransaction[] }>(
        `/api/suppliers/${id}`
      );
      setSupplier(res.data.supplier);
      toast.success('Transaction deleted');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete transaction'));
    }
  };

  const handleEditSave = async () => {
    if (!supplier) return;
    try {
      await updateSupplier(supplier._id, {
        name: editForm.name,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        companyName: editForm.companyName || undefined,
      });
      setSupplier({
        ...supplier,
        name: editForm.name,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        companyName: editForm.companyName || undefined,
      });
      setShowEditModal(false);
      toast.success('Supplier updated');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update supplier'));
    }
  };

  const handleDelete = async () => {
    if (!supplier) return;
    try {
      await deleteSupplier(supplier._id);
      toast.success('Supplier deleted');
      navigate('/suppliers');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete supplier'));
    }
  };

  const openEdit = () => {
    if (!supplier) return;
    setEditForm({
      name: supplier.name,
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      companyName: supplier.companyName ?? '',
    });
    setShowEditModal(true);
    setShowMenu(false);
  };

  const handleSaveOpeningBalance = async () => {
    const parsed = parseFloat(obAmount);
    if (!parsed || parsed <= 0) { toast.error('Valid amount daalo'); return; }
    setObSaving(true);
    try {
      await addTransaction({ supplierId: id!, type: obType, amount: parsed, note: 'Opening Balance (Purani Udhari)' });
      setObAmount('');
      await load();
      toast.success('Opening balance save ho gaya!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save opening balance'));
    } finally {
      setObSaving(false);
    }
  };

  const computeRunningBalances = (txList: SupplierTransaction[]): number[] => {
    const reversed = [...txList].reverse();
    const balances: number[] = [];
    let running = 0;
    for (const tx of reversed) {
      running = tx.type === 'bought' ? running + tx.amount : running - tx.amount;
      balances.push(running);
    }
    return balances.reverse();
  };

  if (isLoading) return <div className="flex justify-center items-center h-full py-20"><Spinner size={36} /></div>;
  if (!supplier) return null;

  const hasDue = supplier.totalDue > 0;
  const runningBalances = computeRunningBalances(transactions);

  const handleRemind = () => {
    if (!supplier.phone) return;
    const phone = supplier.phone.replace(/\D/g, '');
    const amount = `₹${Math.abs(supplier.totalDue).toLocaleString('en-IN')}`;
    const msg = hasDue
      ? `Namaste ${supplier.name} ji 🙏\n\nAapka ${amount} ka payment humse pending hai. Jald hi settle karenge. Shukriya!`
      : `Namaste ${supplier.name} ji 🙏\n\nHumne aapko ${amount} advance diya hua hai. Kripya confirm karein. Shukriya!`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className={`px-4 pt-12 pb-5 ${hasDue ? 'bg-orange-500' : supplier.totalDue < 0 ? 'bg-teal-600' : 'bg-gray-700'}`}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="text-white/80">
            <ArrowLeft size={22} />
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="text-white/80 p-1">
              <MoreVertical size={22} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-gray-100 min-w-[140px] z-10">
                <button onClick={openEdit} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
                  Edit
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Supplier info */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-2xl">
            {supplier.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">{supplier.name}</h1>
            {supplier.companyName && (
              <p className="flex items-center gap-1 text-white/70 text-xs mt-0.5">
                <Building2 size={11} />{supplier.companyName}
              </p>
            )}
            <div className="flex gap-3 mt-0.5">
              {supplier.phone && (
                <a href={`tel:${supplier.phone}`} className="flex items-center gap-1 text-white/70 text-xs">
                  <Phone size={11} />{supplier.phone}
                </a>
              )}
              {supplier.email && (
                <span className="flex items-center gap-1 text-white/70 text-xs">
                  <Mail size={11} />{supplier.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Due amount */}
        <div className="mt-4 bg-white/20 rounded-2xl px-4 py-3 flex justify-between items-center">
          <div>
            <p className="text-white/70 text-xs">
              {hasDue ? 'You owe them' : supplier.totalDue < 0 ? 'They owe you (advance)' : 'Settled'}
            </p>
            <p className="text-white text-2xl font-bold mt-0.5">
              ₹{Math.abs(supplier.totalDue).toLocaleString('en-IN')}
            </p>
          </div>
          {supplier.phone && supplier.totalDue !== 0 && (
            <button
              onClick={handleRemind}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <MessageCircle size={14} />
              Remind
            </button>
          )}
        </div>
      </div>

      {/* Transaction list header */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto pb-24">
        {transactions.length === 0 ? (
          <div>
            {/* Opening Balance (Purani Udhari) quick-entry card */}
            <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="font-semibold text-amber-800 text-sm mb-1">Purani Udhari / Opening Balance</p>
              <p className="text-xs text-amber-600 mb-3">Agar is supplier ke saath pehle se koi hisaab hai to yahan daal do</p>

              {/* Type toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setObType('bought')}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    obType === 'bought' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  Maine kharida (I owe)
                </button>
                <button
                  onClick={() => setObType('paid')}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    obType === 'paid' ? 'bg-teal-500 text-white' : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  Maine diya (Advance)
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  ref={obInputRef}
                  type="number"
                  inputMode="numeric"
                  placeholder="Amount daalo ₹"
                  value={obAmount}
                  onChange={(e) => setObAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveOpeningBalance()}
                  className="flex-1 border border-amber-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                />
                <button
                  onClick={handleSaveOpeningBalance}
                  disabled={obSaving || !obAmount}
                  className="bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {obSaving ? '...' : 'Save'}
                </button>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4 px-4">
              Neeche ke buttons se nayi transaction add karo — kharida ya diya
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 px-4 py-2 bg-gray-50 border-b border-gray-100">
              Neeche ke buttons se directly amount daal sakte ho
            </p>
            {transactions.map((tx, idx) => {
              const bal = runningBalances[idx];
              return (
                <div key={tx._id} className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-gray-50">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'bought' ? 'bg-orange-100' : 'bg-teal-100'
                    }`}
                  >
                    {tx.type === 'bought'
                      ? <Plus size={16} className="text-orange-500" />
                      : <Minus size={16} className="text-teal-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${tx.type === 'bought' ? 'text-orange-600' : 'text-teal-600'}`}>
                      {tx.type === 'bought' ? '+ ' : '− '}₹{tx.amount.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {tx.note ?? (tx.type === 'bought' ? 'Kharida' : 'Diya')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{format(new Date(tx.createdAt), 'd MMM yy')}</p>
                    <p className={`text-[10px] font-medium mt-0.5 ${bal >= 0 ? 'text-orange-500' : 'text-teal-500'}`}>
                      Bal: ₹{Math.abs(bal).toLocaleString('en-IN')} {bal >= 0 ? '↑' : '↓'}
                    </p>
                    <button
                      onClick={() => setTxToDelete({ id: tx._id, amount: tx.amount })}
                      className="mt-1 text-gray-200 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Bottom action buttons */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        <button
          onClick={() => { setTxType('bought'); setShowTxModal(true); }}
          className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          Kharida (Bought)
        </button>
        <button
          onClick={() => { setTxType('paid'); setShowTxModal(true); }}
          className="flex-1 bg-teal-500 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <Minus size={18} />
          Diya (Paid)
        </button>
      </div>

      {/* Transaction Modal */}
      <SupplierTransactionModal
        open={showTxModal}
        onClose={() => setShowTxModal(false)}
        supplierId={supplier._id}
        supplierName={supplier.name}
        defaultType={txType}
        onSuccess={load}
      />

      {/* Transaction Delete Confirm */}
      <Modal open={!!txToDelete} onClose={() => setTxToDelete(null)} title="Delete Transaction?">
        <p className="text-gray-500 text-sm mb-5">
          Delete this <strong>₹{txToDelete?.amount.toLocaleString('en-IN')}</strong> transaction? The balance will be reversed. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setTxToDelete(null)} className="btn-secondary">Cancel</button>
          <button
            onClick={async () => {
              if (!txToDelete) return;
              await handleDeleteTx(txToDelete.id);
              setTxToDelete(null);
            }}
            className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold"
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Supplier">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company / Firm Name</label>
            <input
              value={editForm.companyName}
              onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
              className="input-field"
              placeholder="optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              type="tel"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              type="email"
              className="input-field"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowEditModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleEditSave} className="btn-primary">Save</button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Supplier?">
        <p className="text-gray-500 text-sm mb-5">
          This will delete <strong>{supplier.name}</strong> and all their transaction history. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleDelete} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-semibold">
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
