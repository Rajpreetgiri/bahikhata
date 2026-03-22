import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Product, STOCK_UNITS } from '../../types';
import { useInventoryStore } from '../../store/inventoryStore';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../../lib/api';

interface ProductModalProps {
  open: boolean;
  onClose: () => void;
  product?: Product | null; // null = create mode
}

interface FormState {
  name: string;
  sku: string;
  unit: string;
  sellingPrice: string;
  purchasePrice: string;
  stock: string;
  lowStockThreshold: string;
}

const DEFAULT_FORM: FormState = {
  name: '',
  sku: '',
  unit: 'piece',
  sellingPrice: '',
  purchasePrice: '',
  stock: '0',
  lowStockThreshold: '5',
};

export default function ProductModal({ open, onClose, product }: ProductModalProps) {
  const { addProduct, updateProduct } = useInventoryStore();
  const isEdit = !!product;

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku ?? '',
        unit: product.unit,
        sellingPrice: String(product.sellingPrice),
        purchasePrice: product.purchasePrice !== undefined ? String(product.purchasePrice) : '',
        stock: String(product.stock),
        lowStockThreshold: String(product.lowStockThreshold),
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [product, open]);

  const set = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    const sellingPrice = parseFloat(form.sellingPrice);
    if (isNaN(sellingPrice) || sellingPrice < 0) { toast.error('Enter a valid selling price'); return; }

    setSaving(true);
    try {
      const payload: Partial<Product> = {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        unit: form.unit as Product['unit'],
        sellingPrice,
        purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : undefined,
        lowStockThreshold: parseInt(form.lowStockThreshold || '5', 10),
      };

      if (!isEdit) {
        payload.stock = parseInt(form.stock || '0', 10);
      }

      if (isEdit && product) {
        await updateProduct(product._id, payload);
        toast.success('Product updated!');
      } else {
        await addProduct(payload);
        toast.success('Product added!');
      }
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save product'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Product' : 'Add Product'}>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Product Name *</label>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Basmati Rice 5kg"
            className="input-field text-sm py-2.5"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
            <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className="input-field text-sm py-2.5">
              {STOCK_UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">SKU (optional)</label>
            <input
              value={form.sku}
              onChange={(e) => set('sku', e.target.value.toUpperCase())}
              placeholder="e.g. RICE-5"
              className="input-field text-sm py-2.5 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Selling Price (₹) *</label>
            <input
              value={form.sellingPrice}
              onChange={(e) => set('sellingPrice', e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="input-field text-sm py-2.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Price (₹)</label>
            <input
              value={form.purchasePrice}
              onChange={(e) => set('purchasePrice', e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="input-field text-sm py-2.5"
            />
          </div>
        </div>

        {!isEdit && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Opening Stock</label>
            <input
              value={form.stock}
              onChange={(e) => set('stock', e.target.value)}
              type="number"
              min="0"
              placeholder="0"
              className="input-field text-sm py-2.5"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Low Stock Alert Threshold</label>
          <input
            value={form.lowStockThreshold}
            onChange={(e) => set('lowStockThreshold', e.target.value)}
            type="number"
            min="0"
            placeholder="5"
            className="input-field text-sm py-2.5"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Product'}
        </button>
      </div>
    </Modal>
  );
}
