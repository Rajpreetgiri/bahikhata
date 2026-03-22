import { useNavigate } from 'react-router-dom';
import { ChevronRight, Phone, Building2 } from 'lucide-react';
import { Supplier } from '../../types';
import { formatDistanceToNow } from 'date-fns';

interface SupplierCardProps {
  supplier: Supplier;
}

export default function SupplierCard({ supplier }: SupplierCardProps) {
  const navigate = useNavigate();
  const hasDue = supplier.totalDue > 0;
  const isSettled = supplier.totalDue === 0;

  return (
    <button
      onClick={() => navigate(`/suppliers/${supplier._id}`)}
      className="w-full flex items-center gap-3 bg-white px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
    >
      {/* Avatar */}
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0 ${
          hasDue ? 'bg-orange-500' : isSettled ? 'bg-green-500' : 'bg-purple-500'
        }`}
      >
        {supplier.name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{supplier.name}</p>
        {supplier.companyName ? (
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <Building2 size={10} />
            {supplier.companyName}
          </p>
        ) : supplier.phone ? (
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <Phone size={10} />
            {supplier.phone}
          </p>
        ) : supplier.lastTransactionAt ? (
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDistanceToNow(new Date(supplier.lastTransactionAt), { addSuffix: true })}
          </p>
        ) : null}
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0 mr-1">
        {supplier.totalDue !== 0 ? (
          <>
            <p className={`font-bold text-sm ${hasDue ? 'text-orange-600' : 'text-green-600'}`}>
              ₹{Math.abs(supplier.totalDue).toLocaleString('en-IN')}
            </p>
            <p className={`text-xs mt-0.5 ${hasDue ? 'text-orange-400' : 'text-green-400'}`}>
              {hasDue ? 'you owe' : 'advance'}
            </p>
          </>
        ) : (
          <p className="text-xs text-gray-400 font-medium">Settled</p>
        )}
      </div>

      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </button>
  );
}
