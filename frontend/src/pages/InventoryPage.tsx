import { useEffect, useState } from 'react';
import { Package, Plus, AlertTriangle, MoreVertical, Pencil, Sliders, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../lib/api';
import { useInventoryStore } from '../store/inventoryStore';
import { Product } from '../types';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ProductModal from '../components/features/ProductModal';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/layout/PageHeader';

export default function InventoryPage() {
  const { products, isLoading, loadProducts, adjustStock, deleteProduct } = useInventoryStore();
  const [search, setSearch] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [menuProduct, setMenuProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustValue, setAdjustValue] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadProducts(); }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku?.toLowerCase().includes(search.toLowerCase()))
  );

  const lowStockCount = products.filter((p) => p.stock <= p.lowStockThreshold).length;

  const handleAdjust = async () => {
    if (!adjustProduct) return;
    const adj = parseFloat(adjustValue);
    if (isNaN(adj) || adj === 0) { toast.error('Enter a non-zero adjustment'); return; }
    setAdjusting(true);
    try {
      await adjustStock(adjustProduct._id, adj);
      toast.success(`Stock adjusted by ${adj > 0 ? '+' : ''}${adj}`);
      setAdjustProduct(null);
      setAdjustValue('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to adjust stock'));
    } finally {
      setAdjusting(false);
    }
  };

  const handleDelete = async (product: Product) => {
    setDeleting(true);
    try {
      await deleteProduct(product._id);
      toast.success('Product deleted');
      setMenuProduct(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to delete product'));
    } finally {
      setDeleting(false);
    }
  };

  const stockColor = (p: Product) => {
    if (p.stock === 0) return 'text-red-600 bg-red-50';
    if (p.stock <= p.lowStockThreshold) return 'text-orange-600 bg-orange-50';
    return 'text-green-700 bg-green-50';
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Inventory"
        action={{ label: 'Add', icon: Plus, onClick: () => { setEditProduct(null); setShowProductModal(true); } }}
      />
      <div className="bg-white px-4 md:px-6 pb-3 pt-3 border-b border-gray-100">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="input-field pl-9 text-sm py-2.5"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Low stock banner */}
        {lowStockCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border-b border-orange-100">
            <AlertTriangle size={16} className="text-orange-500 flex-shrink-0" />
            <p className="text-sm text-orange-700 font-medium">
              {lowStockCount} product{lowStockCount !== 1 ? 's' : ''} low on stock
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : filtered.length === 0 ? (
          products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Add your first product to start tracking inventory"
              action={
                <button onClick={() => setShowProductModal(true)} className="btn-primary max-w-xs">
                  Add Product
                </button>
              }
            />
          ) : (
            <EmptyState icon={Search} title="No results" description="Try a different search term" />
          )
        ) : (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5 bg-gray-50">
              Products ({filtered.length})
            </p>
            {filtered.map((p) => (
              <div key={p._id} className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-gray-50">
                {/* Unit badge */}
                <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-brand-600">{p.unit.slice(0, 3).toUpperCase()}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">
                    ₹{p.sellingPrice.toLocaleString('en-IN')}
                    {p.sku && <span className="ml-2 font-mono text-gray-300">{p.sku}</span>}
                  </p>
                </div>

                <div className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${stockColor(p)}`}>
                  {p.stock} {p.unit}
                </div>

                <button
                  onClick={() => setMenuProduct(p)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  <MoreVertical size={16} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Product create/edit modal */}
      <ProductModal
        open={showProductModal}
        onClose={() => { setShowProductModal(false); setEditProduct(null); }}
        product={editProduct}
      />

      {/* Three-dot menu modal */}
      <Modal open={!!menuProduct} onClose={() => setMenuProduct(null)} title={menuProduct?.name ?? ''}>
        <div className="space-y-2">
          <button
            onClick={() => { setEditProduct(menuProduct); setShowProductModal(true); setMenuProduct(null); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left"
          >
            <Pencil size={16} className="text-brand-500" />
            <span className="font-medium text-gray-800">Edit Product</span>
          </button>
          <button
            onClick={() => { setAdjustProduct(menuProduct); setMenuProduct(null); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-left"
          >
            <Sliders size={16} className="text-orange-500" />
            <span className="font-medium text-gray-800">Adjust Stock</span>
          </button>
          <button
            onClick={() => menuProduct && handleDelete(menuProduct)}
            disabled={deleting}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 text-left"
          >
            <Trash2 size={16} className="text-red-500" />
            <span className="font-medium text-red-600">{deleting ? 'Deleting...' : 'Delete Product'}</span>
          </button>
        </div>
      </Modal>

      {/* Adjust Stock modal */}
      <Modal open={!!adjustProduct} onClose={() => { setAdjustProduct(null); setAdjustValue(''); }} title="Adjust Stock">
        {adjustProduct && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Current stock: <strong>{adjustProduct.stock} {adjustProduct.unit}</strong>
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Adjustment (use negative to remove stock)
              </label>
              <input
                type="number"
                step="0.001"
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value)}
                placeholder="e.g. +10 or -5"
                className="input-field"
                autoFocus
              />
            </div>
            {adjustValue && !isNaN(parseFloat(adjustValue)) && (
              <p className="text-xs text-gray-500">
                New stock: <strong>{(adjustProduct.stock + parseFloat(adjustValue)).toFixed(3)} {adjustProduct.unit}</strong>
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setAdjustProduct(null); setAdjustValue(''); }} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleAdjust} disabled={adjusting} className="btn-primary">
                {adjusting ? 'Saving...' : 'Apply'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
