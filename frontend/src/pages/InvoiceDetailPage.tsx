import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, CheckCircle, XCircle, Share2, FileText, BookOpen, CreditCard, Mail, SplitSquareHorizontal, RotateCcw, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api, { getApiErrorMessage } from '../lib/api';
import { useInvoiceStore } from '../store/invoiceStore';
import { Invoice, PopulatedCustomer } from '../types';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';

const partialPaySchema = z.object({
  amount: z.string().min(1).refine((v) => parseFloat(v) >= 1, 'Minimum amount is ₹1'),
});
type PartialPayForm = z.infer<typeof partialPaySchema>;

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { markAsPaid, partialPay, cancelInvoice, returnInvoice } = useInvoiceStore();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [showPartialPay, setShowPartialPay] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PartialPayForm>({
    resolver: zodResolver(partialPaySchema),
  });

  useEffect(() => { loadInvoice(); }, [id]);

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const res = await api.get<Invoice>(`/api/invoices/${id}`);
      setInvoice(res.data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Invoice not found'));
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!invoice) return;
    setShowPayConfirm(false);
    setActionLoading(true);
    try {
      await markAsPaid(invoice._id);
      await loadInvoice();
      toast.success('Invoice marked as paid!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to mark as paid'));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePartialPay = async (data: PartialPayForm) => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      const updated = await partialPay(invoice._id, parseFloat(data.amount));
      setInvoice(updated);
      setShowPartialPay(false);
      reset();
      const remaining = updated.totalAmount - updated.paidAmount;
      if (updated.status === 'paid') {
        toast.success('Invoice fully paid!');
      } else {
        toast.success(`₹${parseFloat(data.amount).toLocaleString('en-IN')} received. Remaining: ₹${remaining.toLocaleString('en-IN')}`);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to record payment'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!invoice) return;
    setShowCancelConfirm(false);
    setActionLoading(true);
    try {
      await cancelInvoice(invoice._id);
      await loadInvoice();
      toast.success('Invoice cancelled');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to cancel invoice'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!invoice) return;
    setShowReturnConfirm(false);
    setActionLoading(true);
    try {
      await returnInvoice(invoice._id);
      await loadInvoice();
      toast.success('Invoice returned — stock restored, balance reversed');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to process return'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleClone = () => {
    if (!invoice) return;
    navigate('/invoices/create', {
      state: {
        cloneFrom: {
          customerId: typeof invoice.customerId === 'object' ? (invoice.customerId as { _id: string })._id : invoice.customerId,
          items: invoice.items.map((item) => ({ productId: String(item.productId), quantity: item.quantity })),
          gstPercent: invoice.gstPercent ?? 0,
          note: invoice.note ?? '',
        },
      },
    });
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    setPdfDownloading(true);
    try {
      const res = await api.get(`/api/invoices/${invoice._id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to download PDF'));
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleEmailInvoice = async () => {
    if (!invoice) return;
    const customer = typeof invoice.customerId === 'object' ? invoice.customerId as PopulatedCustomer : null;
    if (!customer?.email) {
      toast.error('Customer has no email address on file');
      return;
    }
    setEmailSending(true);
    try {
      await api.post(`/api/invoices/${invoice._id}/email`);
      toast.success(`Invoice sent to ${customer.email}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to send email'));
    } finally {
      setEmailSending(false);
    }
  };

  const handleWhatsApp = () => {
    if (!invoice) return;
    const customer = typeof invoice.customerId === 'object' ? invoice.customerId as PopulatedCustomer : null;
    const phone = customer?.phone?.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Invoice ${invoice.invoiceNumber}\nAmount: ₹${invoice.totalAmount.toLocaleString('en-IN')}\nStatus: ${invoice.status.toUpperCase()}`
    );
    const url = phone ? `https://wa.me/91${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={32} /></div>;
  }

  if (!invoice) return null;

  const customer = typeof invoice.customerId === 'object' ? invoice.customerId as PopulatedCustomer : null;
  const paidAmount = invoice.paidAmount ?? 0;
  const remaining = parseFloat((invoice.totalAmount - paidAmount).toFixed(2));
  const isActionable = invoice.status === 'unpaid' || invoice.status === 'partially_paid';

  const headerColors: Record<string, string> = {
    unpaid: 'bg-amber-500',
    partially_paid: 'bg-amber-600',
    paid: 'bg-green-500',
    cancelled: 'bg-gray-400',
    returned: 'bg-purple-500',
  };
  const headerBg = headerColors[invoice.status] ?? 'bg-gray-400';

  return (
    <div className="flex flex-col min-h-full">
      {/* Colored header */}
      <div className={`${headerBg} px-4 pt-12 pb-6 text-white`}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20">
            <ArrowLeft size={20} />
          </button>
          <span className="text-white/80 text-sm font-medium uppercase tracking-wide">Invoice</span>
        </div>
        <h1 className="text-3xl font-bold">{invoice.invoiceNumber}</h1>
        <p className="text-white/80 text-sm mt-1">
          {new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        {invoice.dueDate && (
          <p className="text-white/80 text-sm">
            Due: {new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-2">
          {invoice.paymentMode === 'credit' ? (
            <span className="flex items-center gap-1 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <BookOpen size={11} /> Udhari
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <CreditCard size={11} /> Paid Now
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-56 space-y-4">
        {/* Customer card */}
        {customer && (
          <div className="card">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
            <p className="font-bold text-gray-800">{customer.name}</p>
            {customer.phone && <p className="text-sm text-gray-500 mt-0.5">{customer.phone}</p>}
            {customer.email && <p className="text-sm text-gray-500">{customer.email}</p>}
          </div>
        )}

        {/* Partial payment progress */}
        {invoice.status === 'partially_paid' && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
            <p className="font-semibold text-amber-800 text-sm mb-2">Partially Paid</p>
            <div className="w-full bg-amber-200 rounded-full h-2 mb-2">
              <div
                className="bg-amber-500 h-2 rounded-full"
                style={{ width: `${Math.min(100, (paidAmount / invoice.totalAmount) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-amber-700">
              <span>Paid: ₹{paidAmount.toLocaleString('en-IN')}</span>
              <span>Remaining: ₹{remaining.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

        {/* Paid banner */}
        {invoice.status === 'paid' && invoice.paidAt && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
            <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800 text-sm">Payment Received</p>
              <p className="text-xs text-green-600">
                {new Date(invoice.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}

        {/* Cancelled banner */}
        {invoice.status === 'cancelled' && (
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
            <XCircle size={20} className="text-gray-400 flex-shrink-0" />
            <p className="font-semibold text-gray-600 text-sm">Invoice Cancelled</p>
          </div>
        )}

        {/* Returned banner */}
        {invoice.status === 'returned' && (
          <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3">
            <RotateCcw size={20} className="text-purple-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-purple-800 text-sm">Invoice Returned</p>
              <p className="text-xs text-purple-600">Stock restored • Balance reversed</p>
            </div>
          </div>
        )}

        {/* Items table */}
        <div className="card overflow-hidden">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Items</p>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
              <span className="col-span-5">Item</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-2 text-right">Price</span>
              <span className="col-span-3 text-right">Total</span>
            </div>
            {invoice.items.map((item, i) => (
              <div key={i} className={`grid grid-cols-12 px-3 py-2.5 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                <div className="col-span-5">
                  <p className="font-medium text-gray-800 leading-tight">{item.productName}</p>
                  <p className="text-xs text-gray-400">{item.unit}</p>
                </div>
                <span className="col-span-2 text-center text-gray-600">{item.quantity}</span>
                <span className="col-span-2 text-right text-gray-600">₹{item.unitPrice.toLocaleString('en-IN')}</span>
                <span className="col-span-3 text-right font-medium text-gray-800">₹{item.total.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="card">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>₹{invoice.subtotal.toLocaleString('en-IN')}</span>
            </div>
            {invoice.gstPercent && invoice.gstAmount ? (
              <div className="flex justify-between text-sm text-gray-600">
                <span>GST ({invoice.gstPercent}%)</span>
                <span>₹{invoice.gstAmount.toLocaleString('en-IN')}</span>
              </div>
            ) : null}
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1.5 border-t border-gray-100">
              <span>Total</span>
              <span>₹{invoice.totalAmount.toLocaleString('en-IN')}</span>
            </div>
            {paidAmount > 0 && invoice.status !== 'paid' && (
              <>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Paid so far</span>
                  <span>₹{paidAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-semibold text-amber-700 pt-1 border-t border-gray-100">
                  <span>Remaining</span>
                  <span>₹{remaining.toLocaleString('en-IN')}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {invoice.note && (
          <div className="card">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Note</p>
            <p className="text-sm text-gray-700">{invoice.note}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="fixed left-0 right-0 md:relative md:bottom-auto bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-auto bg-white border-t border-gray-100 p-4 pb-4 md:pb-4">
        <div className="md:max-w-4xl md:mx-auto space-y-3">
          {isActionable && invoice.paymentMode === 'credit' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowPayConfirm(true)}
                  disabled={actionLoading}
                  className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  Full Pay
                </button>
                <button
                  onClick={() => setShowPartialPay(true)}
                  disabled={actionLoading}
                  className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm disabled:opacity-50"
                >
                  <SplitSquareHorizontal size={16} />
                  Partial Pay
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfDownloading}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 text-sm disabled:opacity-50"
                >
                  <Download size={16} />
                  {pdfDownloading ? 'Downloading...' : 'PDF'}
                </button>
                <button
                  onClick={handleEmailInvoice}
                  disabled={emailSending || !customer?.email}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 font-semibold py-3 rounded-xl hover:bg-blue-100 text-sm disabled:opacity-50"
                >
                  <Mail size={16} />
                  {emailSending ? 'Sending...' : 'Email'}
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-700 font-semibold py-3 rounded-xl hover:bg-green-100 text-sm"
                >
                  <Share2 size={16} />
                  Share
                </button>
              </div>
              <button
                onClick={() => setShowCancelConfirm(true)}
                disabled={actionLoading}
                className="w-full text-red-500 text-sm font-medium py-2 hover:text-red-700"
              >
                Cancel Invoice
              </button>
            </>
          )}

          {invoice.status === 'paid' && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfDownloading}
                  className="flex-1 flex items-center justify-center gap-2 btn-primary text-sm disabled:opacity-50"
                >
                  <FileText size={16} />
                  {pdfDownloading ? 'Downloading...' : 'Download PDF'}
                </button>
                <button
                  onClick={handleEmailInvoice}
                  disabled={emailSending || !customer?.email}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 font-semibold py-3 rounded-xl hover:bg-blue-100 text-sm disabled:opacity-50"
                >
                  <Mail size={16} />
                  {emailSending ? 'Sending...' : 'Email'}
                </button>
                <button
                  onClick={handleClone}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 text-sm"
                >
                  <Copy size={16} />
                  Clone
                </button>
              </div>
              <button
                onClick={() => setShowReturnConfirm(true)}
                disabled={actionLoading}
                className="w-full text-purple-600 text-sm font-medium py-2 hover:text-purple-800"
              >
                Return / Refund Invoice
              </button>
            </div>
          )}

          {(invoice.status === 'cancelled' || invoice.status === 'returned') && (
            <button
              onClick={handleClone}
              className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 text-sm"
            >
              <Copy size={16} />
              Clone as New Invoice
            </button>
          )}
        </div>
      </div>

      {/* Mark Fully Paid confirm */}
      <Modal open={showPayConfirm} onClose={() => setShowPayConfirm(false)} title="Mark as Fully Paid?">
        <p className="text-sm text-gray-600 mb-5">
          This will record a payment of <strong>₹{remaining.toLocaleString('en-IN')}</strong> from{' '}
          {customer?.name ?? 'the customer'} and close this invoice.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setShowPayConfirm(false)} className="btn-secondary flex-shrink-0">Cancel</button>
          <button onClick={handleMarkPaid} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition-colors">
            Confirm
          </button>
        </div>
      </Modal>

      {/* Partial Pay modal */}
      <Modal open={showPartialPay} onClose={() => { setShowPartialPay(false); reset(); }} title="Record Partial Payment">
        <div className="mb-4 bg-amber-50 rounded-xl px-3 py-2">
          <p className="text-xs text-amber-700">Remaining balance: <strong>₹{remaining.toLocaleString('en-IN')}</strong></p>
        </div>
        <form onSubmit={handleSubmit(handlePartialPay)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Received (₹)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-lg">₹</span>
              <input
                {...register('amount')}
                type="number"
                inputMode="decimal"
                placeholder="0"
                max={remaining}
                className="input-field pl-9 text-2xl font-bold"
                autoFocus
              />
            </div>
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setShowPartialPay(false); reset(); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={actionLoading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
              {actionLoading ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel confirm */}
      <Modal open={showCancelConfirm} onClose={() => setShowCancelConfirm(false)} title="Cancel Invoice?">
        <p className="text-sm text-gray-600 mb-5">
          Stock will be restored for all items. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setShowCancelConfirm(false)} className="btn-secondary flex-shrink-0">Keep Invoice</button>
          <button onClick={handleCancel} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-colors">
            Cancel Invoice
          </button>
        </div>
      </Modal>

      {/* Return confirm */}
      <Modal open={showReturnConfirm} onClose={() => setShowReturnConfirm(false)} title="Return Invoice?">
        <p className="text-sm text-gray-600 mb-2">
          This will:
        </p>
        <ul className="text-sm text-gray-600 mb-5 space-y-1 list-disc list-inside">
          <li>Restore stock for all items</li>
          <li>Reverse ₹{invoice?.totalAmount.toLocaleString('en-IN')} from customer balance</li>
          <li>Mark invoice as Returned</li>
        </ul>
        <p className="text-xs text-gray-400 mb-4">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={() => setShowReturnConfirm(false)} className="btn-secondary flex-shrink-0">Keep Invoice</button>
          <button onClick={handleReturn} disabled={actionLoading} className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50">
            Confirm Return
          </button>
        </div>
      </Modal>
    </div>
  );
}
