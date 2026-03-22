import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Camera, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../../lib/api';
import Modal from '../ui/Modal';
import { useTransactionStore } from '../../store/transactionStore';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank' },
  { value: 'other', label: 'Other' },
] as const;

const schema = z.object({
  amount: z.string().min(1).refine((v) => parseFloat(v) > 0, 'Amount must be positive'),
  note: z.string().optional(),
  dueDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  defaultType?: 'gave' | 'got';
  onSuccess?: () => void;
  currentOutstanding?: number;
  creditLimit?: number;
}

export default function TransactionModal({
  open,
  onClose,
  customerId,
  customerName,
  defaultType = 'gave',
  onSuccess,
  currentOutstanding = 0,
  creditLimit,
}: TransactionModalProps) {
  const [type, setType] = useState<'gave' | 'got'>(defaultType);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addTransaction } = useTransactionStore();

  useEffect(() => { setPaymentMethod(''); }, [type]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleClose = () => {
    reset();
    setPaymentMethod('');
    setPhotoUrl(null);
    setPhotoPreview(null);
    onClose();
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to backend
    setUploading(true);
    try {
      const form = new FormData();
      form.append('photo', file);
      const res = await api.post<{ photoUrl: string }>('/api/uploads/photo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotoUrl(res.data.photoUrl);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Photo upload failed'));
      setPhotoPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      await addTransaction({
        customerId,
        type,
        amount: parseFloat(data.amount),
        note: data.note,
        paymentMethod: paymentMethod || undefined,
        photoUrl: photoUrl || undefined,
        dueDate: data.dueDate || undefined,
      });
      toast.success(type === 'gave' ? `Gave ₹${data.amount} to ${customerName}` : `Got ₹${data.amount} from ${customerName}`);
      reset();
      setPaymentMethod('');
      setPhotoUrl(null);
      setPhotoPreview(null);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to record transaction'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Record Transaction">
      {/* Type toggle */}
      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setType('gave')}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${type === 'gave'
            ? 'bg-red-500 text-white shadow-sm'
            : 'bg-red-50 text-red-500 hover:bg-red-100'
            }`}
        >
          You Gave
        </button>
        <button
          type="button"
          onClick={() => setType('got')}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${type === 'got'
            ? 'bg-green-500 text-white shadow-sm'
            : 'bg-green-50 text-green-500 hover:bg-green-100'
            }`}
        >
          You Got
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-lg">₹</span>
            <input
              {...register('amount')}
              type="number"
              inputMode="decimal"
              placeholder="0"
              className="input-field pl-9 font-bold"
              autoFocus
            />
          </div>
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
          {type === 'gave' && creditLimit && creditLimit > 0 && (
            currentOutstanding >= creditLimit ? (
              <p className="text-red-500 text-xs mt-1">Credit limit of ₹{creditLimit.toLocaleString('en-IN')} already reached</p>
            ) : (
              <p className="text-gray-400 text-xs mt-1">
                Credit available: ₹{(creditLimit - currentOutstanding).toLocaleString('en-IN')} of ₹{creditLimit.toLocaleString('en-IN')}
              </p>
            )
          )}
        </div>

        {/* Payment method — only for 'got' */}
        {type === 'got' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method (optional)</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setPaymentMethod(paymentMethod === m.value ? '' : m.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${paymentMethod === m.value
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-green-300'
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Due Date — only for 'gave' */}
        {type === 'gave' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date (optional)</label>
            <input
              {...register('dueDate')}
              type="date"
              className="input-field"
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-400 mt-1">Auto-reminders will trigger based on this date</p>
          </div>
        )}

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Note (optional)</label>
          <input
            {...register('note')}
            type="text"
            placeholder="e.g. grocery, loan..."
            className="input-field"
          />
        </div>

        {/* Photo Proof */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Photo Proof (optional)</label>
          {photoPreview ? (
            <div className="relative inline-block">
              <img src={photoPreview} alt="proof" className="w-24 h-24 object-cover rounded-xl border border-gray-200" />
              <button
                type="button"
                onClick={() => { setPhotoPreview(null); setPhotoUrl(null); }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <X size={11} />
              </button>
              {uploading && (
                <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm hover:border-brand-400 hover:text-brand-500 transition-colors disabled:opacity-50"
            >
              <Camera size={16} />
              {uploading ? 'Uploading...' : 'Attach Photo'}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button type="button" onClick={handleClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || uploading}
            className={`flex-1 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 ${type === 'gave' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              }`}
          >
            {isLoading ? 'Saving...' : `Save ${type === 'gave' ? 'Gave' : 'Got'}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
