import { useNavigate } from 'react-router-dom';
import { ChevronRight, Phone, ArrowDownLeft } from 'lucide-react';
import { Customer } from '../../types';
import { formatDistanceToNow } from 'date-fns';

interface CustomerCardProps {
  customer: Customer;
}

export default function CustomerCard({ customer }: CustomerCardProps) {
  const navigate = useNavigate();
  const hasDebt = customer.totalOutstanding > 0;
  const isSettled = customer.totalOutstanding === 0;

  return (
    <button
      onClick={() => navigate(`/customers/${customer._id}`)}
      className="w-full flex items-center gap-3 bg-white px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
    >
      {/* Avatar */}
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0 ${
          hasDebt ? 'bg-red-500' : isSettled ? 'bg-green-500' : 'bg-blue-500'
        }`}
      >
        {customer.name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{customer.name}</p>
        {customer.phone && (
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <Phone size={10} />
            {customer.phone}
          </p>
        )}
        {customer.lastPaymentAmount && (
          <p className="text-xs text-green-500 flex items-center gap-1 mt-0.5">
            <ArrowDownLeft size={10} />
            ₹{customer.lastPaymentAmount.toLocaleString('en-IN')} received
            {customer.lastTransactionAt && (
              <span className="text-gray-400">
                · {formatDistanceToNow(new Date(customer.lastTransactionAt), { addSuffix: true })}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0 mr-1">
        {customer.totalOutstanding !== 0 ? (
          <>
            <p className={`font-bold text-sm ${hasDebt ? 'text-red-600' : 'text-green-600'}`}>
              ₹{Math.abs(customer.totalOutstanding).toLocaleString('en-IN')}
            </p>
            <p className={`text-xs mt-0.5 ${hasDebt ? 'text-red-400' : 'text-green-400'}`}>
              {hasDebt ? 'will give' : 'advance'}
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
