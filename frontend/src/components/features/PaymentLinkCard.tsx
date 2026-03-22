import { useState } from 'react';
import { Link, Copy, Check, MessageCircle, ExternalLink, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getApiErrorMessage } from '../../lib/api';
import { Payment, Customer } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { formatDistanceToNow } from 'date-fns';
import Modal from '../ui/Modal';

interface PaymentLinkCardProps {
  customer: Customer;
  payments: Payment[];
  onPaymentCreated: (payment: Payment) => void;
}

export default function PaymentLinkCard({ customer, payments: initialPayments, onPaymentCreated }: PaymentLinkCardProps) {
  const [payments, setPayments] = useState(initialPayments);
  const [amount, setAmount] = useState(customer.totalOutstanding > 0 ? String(Math.round(customer.totalOutstanding)) : '');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [confirmPayment, setConfirmPayment] = useState<Payment | null>(null);
  const { user } = useAuthStore();

  const createLink = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post<Payment>('/api/payments/create-link', {
        customerId: customer._id,
        amount: parseFloat(amount),
      });
      const newPayment = res.data;
      onPaymentCreated(newPayment);
      setPayments((prev) => [newPayment, ...prev]);
      toast.success('Payment link created!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to create payment link'));
    } finally {
      setCreating(false);
    }
  };

  const handleMarkPaid = async (payment: Payment) => {
    setMarkingPaidId(payment._id);
    setConfirmPayment(null);
    try {
      const res = await api.patch<Payment>(`/api/payments/${payment._id}/mark-paid`);
      setPayments((prev) => prev.map((p) => (p._id === payment._id ? res.data : p)));
      toast.success(`₹${payment.amount.toLocaleString('en-IN')} marked as received`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to mark payment'));
    } finally {
      setMarkingPaidId(null);
    }
  };

  const copyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shareOnWhatsApp = (payment: Payment) => {
    if (!customer.phone) {
      toast.error('No phone on file');
      return;
    }
    const msg =
      `Namaste ${customer.name} ji 🙏\n\n` +
      `${user?.businessName ?? 'We'} ki taraf se payment link bhej raha hoon.\n\n` +
      `Amount: ₹${payment.amount.toLocaleString('en-IN')}\n\n` +
      `Payment link: ${payment.razorpayPaymentLinkUrl}\n\n` +
      `Shukriya! 🙏`;
    const phone = customer.phone.replace(/\D/g, '');
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-3">
      {/* Create new link */}
      <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
        <p className="text-sm font-semibold text-brand-700 mb-3">Generate Payment Link</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="input-field pl-8"
            />
          </div>
          <button
            onClick={createLink}
            disabled={creating}
            className="bg-brand-500 text-white px-4 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Link size={16} />
            {creating ? '...' : 'Create'}
          </button>
        </div>
      </div>

      {/* Existing links */}
      {payments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Payment Links</p>
          {payments.map((p) => (
            <div key={p._id} className="bg-white border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800">₹{p.amount.toLocaleString('en-IN')}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {p.status === 'paid' ? 'Paid' : 'Pending'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
              </p>
              <div className="flex gap-2 flex-wrap">
                {p.status === 'pending' && (
                  <>
                    <button
                      onClick={() => copyLink(p.razorpayPaymentLinkUrl, p._id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {copiedId === p._id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      {copiedId === p._id ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => window.open(p.razorpayPaymentLinkUrl, '_blank')}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ExternalLink size={14} />
                    </button>
                    {customer.phone && (
                      <button
                        onClick={() => shareOnWhatsApp(p)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors"
                      >
                        <MessageCircle size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmPayment(p)}
                      disabled={markingPaidId === p._id}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {markingPaidId === p._id ? (
                        <div className="w-3 h-3 animate-spin rounded-full border border-teal-400 border-t-teal-700" />
                      ) : (
                        <CheckCircle size={14} />
                      )}
                      Got Cash
                    </button>
                  </>
                )}
                {p.status === 'paid' && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircle size={13} />
                    Payment received
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mark Paid Confirmation */}
      <Modal open={!!confirmPayment} onClose={() => setConfirmPayment(null)} title="Mark as Received?">
        <p className="text-gray-500 text-sm mb-5">
          Confirm that you received <strong>₹{confirmPayment?.amount.toLocaleString('en-IN')}</strong> via cash or bank transfer?
          This will add a "You Got" transaction and update the outstanding balance.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmPayment(null)} className="btn-secondary">Cancel</button>
          <button
            onClick={() => confirmPayment && handleMarkPaid(confirmPayment)}
            className="flex-1 bg-teal-500 text-white py-3 rounded-xl font-semibold"
          >
            Yes, Received
          </button>
        </div>
      </Modal>
    </div>
  );
}
