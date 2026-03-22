import { Trash2 } from 'lucide-react';
import { Product } from '../../types';

export interface ItemRowValue {
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceItemRowProps {
  index: number;
  products: Product[];
  value: ItemRowValue;
  onChange: (value: ItemRowValue) => void;
  onRemove: () => void;
}

export default function InvoiceItemRow({ index, products, value, onChange, onRemove }: InvoiceItemRowProps) {
  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p._id === productId);
    onChange({
      productId,
      quantity: value.quantity || 1,
      unitPrice: product ? product.sellingPrice : 0,
    });
  };

  const total = value.quantity * value.unitPrice;

  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 font-medium pt-2.5 w-5 flex-shrink-0">{index + 1}.</span>

      <div className="flex-1 min-w-0 space-y-2">
        {/* Product select */}
        <select
          value={value.productId}
          onChange={(e) => handleProductChange(e.target.value)}
          className="input-field text-sm py-2"
        >
          <option value="">Select product...</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name} (₹{p.sellingPrice}/{p.unit})
            </option>
          ))}
        </select>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Qty</label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={value.quantity || ''}
              onChange={(e) => onChange({ ...value, quantity: parseFloat(e.target.value) || 0 })}
              placeholder="1"
              className="input-field text-sm py-2"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Unit Price (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value.unitPrice || ''}
              onChange={(e) => onChange({ ...value, unitPrice: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className="input-field text-sm py-2"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Total</label>
            <div className="input-field text-sm py-2 bg-gray-50 text-gray-600 font-medium">
              ₹{isNaN(total) ? '0.00' : total.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onRemove}
        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors mt-0.5 flex-shrink-0"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
