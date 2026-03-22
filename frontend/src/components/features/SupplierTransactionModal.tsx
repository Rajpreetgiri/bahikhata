import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../../lib/api';
import Modal from '../ui/Modal';
import { useSupplierTransactionStore } from '../../store/supplierTransactionStore';

const schema = z.object({
  amount: z.string().min(1).refine((v) => parseFloat(v) > 0, 'Amount must be positive'),
  note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface SupplierTransactionModalProps {
  open: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
  defaultType?: 'bought' | 'paid';
  onSuccess?: () => void;
}

export default function SupplierTransactionModal({
  open,
  onClose,
  supplierId,
  supplierName,
  defaultType = 'bought',
  onSuccess,
}: SupplierTransactionModalProps) {
  const [type, setType] = useState<'bought' | 'paid'>(defaultType);
  const [isLoading, setIsLoading] = useState(false);
  const { addTransaction } = useSupplierTransactionStore();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      await addTransaction({
        supplierId,
        type,
        amount: parseFloat(data.amount),
        note: data.note,
      });
      toast.success(
        type === 'bought'
          ? `Bought ₹${data.amount} from ${supplierName}`
          : `Paid ₹${data.amount} to ${supplierName}`
      );
      reset();
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
          onClick={() => setType('bought')}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${type === 'bought'
            ? 'bg-orange-500 text-white shadow-sm'
            : 'bg-orange-50 text-orange-500 hover:bg-orange-100'
            }`}
        >
          You Bought
        </button>
        <button
          type="button"
          onClick={() => setType('paid')}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${type === 'paid'
            ? 'bg-teal-500 text-white shadow-sm'
            : 'bg-teal-50 text-teal-500 hover:bg-teal-100'
            }`}
        >
          You Paid
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-lg">₹</span>
            <input
              {...register('amount')}
              type="number"
              inputMode="decimal"
              placeholder="0"
              className="input-field pl-9 text-2xl font-bold"
              autoFocus
            />
          </div>
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Note (optional)</label>
          <input
            {...register('note')}
            type="text"
            placeholder="e.g. rice 50kg, advance payment..."
            className="input-field"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button type="button" onClick={handleClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className={`flex-1 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 ${type === 'bought' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-teal-500 hover:bg-teal-600'
              }`}
          >
            {isLoading ? 'Saving...' : `Save ${type === 'bought' ? 'Bought' : 'Paid'}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
