import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, CreditCard, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../lib/api';
import { useInvoiceStore } from '../store/invoiceStore';
import { useInventoryStore } from '../store/inventoryStore';
import { useCustomerStore } from '../store/customerStore';
import InvoiceItemRow, { ItemRowValue } from '../components/features/InvoiceItemRow';
import PageHeader from '../components/layout/PageHeader';
import { InvoicePaymentMode } from '../types';

const GST_CHIPS = [0, 5, 12, 18, 28];

interface CloneState {
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  gstPercent: number;
  note: string;
}

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { customers, loadCustomers } = useCustomerStore();
  const { products, loadProducts } = useInventoryStore();
  const { createInvoice } = useInvoiceStore();

  const cloneFrom = (location.state as { cloneFrom?: CloneState } | null)?.cloneFrom;

  const [customerId, setCustomerId] = useState(cloneFrom?.customerId ?? searchParams.get('customerId') ?? '');
  const [paymentMode, setPaymentMode] = useState<InvoicePaymentMode>('credit');
  const [items, setItems] = useState<ItemRowValue[]>(
    cloneFrom?.items.map((i) => {
      const product = { sellingPrice: 0 }; // will be resolved after products load
      return { productId: i.productId, quantity: i.quantity, unitPrice: product.sellingPrice };
    }) ?? [{ productId: '', quantity: 1, unitPrice: 0 }]
  );
  const [gstPercent, setGstPercent] = useState(cloneFrom?.gstPercent ?? 0);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState(cloneFrom?.note ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([loadCustomers(), loadProducts()]);
  }, []);

  // After products load, resolve unit prices for cloned items
  useEffect(() => {
    if (cloneFrom && products.length > 0) {
      setItems(cloneFrom.items.map((i) => {
        const product = products.find((p) => p._id === i.productId);
        return {
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: product?.sellingPrice ?? 0,
        };
      }));
    }
  }, [products]);

  const addItem = () => setItems([...items, { productId: '', quantity: 1, unitPrice: 0 }]);

  const updateItem = (index: number, value: ItemRowValue) => {
    const next = [...items];
    next[index] = value;
    // Warn if same product appears in multiple rows
    if (value.productId) {
      const duplicates = next.filter((item, i) => i !== index && item.productId === value.productId);
      if (duplicates.length > 0) {
        toast.error('This product is already in the list. Consider increasing quantity instead.', { id: 'dup-product' });
      }
    }
    setItems(next);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) { toast.error('At least one item required'); return; }
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  const gstAmount = gstPercent > 0 ? subtotal * gstPercent / 100 : 0;
  const totalAmount = subtotal + gstAmount;

  const handleCreate = async () => {
    if (!customerId) { toast.error('Select a customer'); return; }
    const validItems = items.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) { toast.error('Add at least one item with a product'); return; }

    setSaving(true);
    try {
      const invoice = await createInvoice({
        customerId,
        items: validItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        gstPercent: gstPercent || undefined,
        dueDate: paymentMode === 'credit' ? (dueDate || undefined) : undefined,
        note: note.trim() || undefined,
        paymentMode,
      });
      const msg = paymentMode === 'credit'
        ? `Invoice ${invoice.invoiceNumber} created — added to udhari`
        : `Invoice ${invoice.invoiceNumber} created — marked as paid`;
      toast.success(msg);
      navigate(`/invoices/${invoice._id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to create invoice'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title={cloneFrom ? 'Clone Invoice' : 'New Invoice'} onBack={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto p-4 pb-44 space-y-4">
        {/* Payment Mode Toggle — the most important decision */}
        <div className="card">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Payment Mode *</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPaymentMode('credit')}
              className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${
                paymentMode === 'credit'
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-100 bg-gray-50 hover:border-gray-200'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMode === 'credit' ? 'bg-orange-100' : 'bg-gray-100'}`}>
                <BookOpen size={20} className={paymentMode === 'credit' ? 'text-orange-500' : 'text-gray-400'} />
              </div>
              <div className="text-center">
                <p className={`font-bold text-sm ${paymentMode === 'credit' ? 'text-orange-700' : 'text-gray-600'}`}>Udhari (Credit)</p>
                <p className={`text-xs mt-0.5 ${paymentMode === 'credit' ? 'text-orange-500' : 'text-gray-400'}`}>Udhaar hai, baad mein milega</p>
              </div>
            </button>
            <button
              onClick={() => setPaymentMode('paid')}
              className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${
                paymentMode === 'paid'
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-100 bg-gray-50 hover:border-gray-200'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMode === 'paid' ? 'bg-green-100' : 'bg-gray-100'}`}>
                <CreditCard size={20} className={paymentMode === 'paid' ? 'text-green-500' : 'text-gray-400'} />
              </div>
              <div className="text-center">
                <p className={`font-bold text-sm ${paymentMode === 'paid' ? 'text-green-700' : 'text-gray-600'}`}>Paid Now</p>
                <p className={`text-xs mt-0.5 ${paymentMode === 'paid' ? 'text-green-500' : 'text-gray-400'}`}>Cash / UPI / Card</p>
              </div>
            </button>
          </div>
          {paymentMode === 'credit' && (
            <p className="text-xs text-orange-600 bg-orange-50 rounded-xl px-3 py-2 mt-2">
              Saman diya, paisa baad mein milega — customer ki khata mein jaayega
            </p>
          )}
          {paymentMode === 'paid' && (
            <p className="text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2 mt-2">
              Customer ne abhi pay kar diya — invoice turant paid ho jaayega
            </p>
          )}
        </div>

        {/* Customer */}
        <div className="card">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Customer *</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="input-field"
          >
            <option value="">Select customer...</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>
            ))}
          </select>
        </div>

        {/* Items */}
        <div className="card">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Items *</label>
          {items.map((item, i) => (
            <InvoiceItemRow
              key={i}
              index={i}
              products={products}
              value={item}
              onChange={(v) => updateItem(i, v)}
              onRemove={() => removeItem(i)}
            />
          ))}
          <button
            onClick={addItem}
            className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 text-gray-400 font-medium py-2.5 rounded-xl hover:border-brand-300 hover:text-brand-500 transition-colors text-sm"
          >
            <Plus size={15} />
            Add Item
          </button>
        </div>

        {/* GST */}
        <div className="card">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">GST</label>
          <div className="flex gap-2 flex-wrap">
            {GST_CHIPS.map((g) => (
              <button
                key={g}
                onClick={() => setGstPercent(g)}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                  gstPercent === g ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {g}%
              </button>
            ))}
          </div>
        </div>

        {/* Due date + note — due date only relevant for credit invoices */}
        <div className="card space-y-3">
          {paymentMode === 'credit' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Due Date (optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input-field text-sm py-2.5"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any additional notes..."
              className="input-field text-sm py-2.5 resize-none"
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Sticky totals + CTA — on mobile sit above bottom nav */}
      <div className="fixed left-0 right-0 md:relative md:bottom-auto bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-auto bg-white border-t border-gray-100 p-4 pb-4 md:pb-4">
        <div className="md:max-w-4xl md:mx-auto">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {gstAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>GST ({gstPercent}%)</span>
              <span>₹{gstAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-base mb-3 pt-1 border-t border-gray-100">
            <span>Total</span>
            <span>₹{totalAmount.toFixed(2)}</span>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving}
            className={`w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
              paymentMode === 'credit'
                ? 'bg-orange-500 hover:bg-orange-600'
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating...
              </>
            ) : paymentMode === 'credit' ? (
              <>
                <BookOpen size={18} />
                Add to Udhari
              </>
            ) : (
              <>
                <CreditCard size={18} />
                Create Paid Invoice
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
