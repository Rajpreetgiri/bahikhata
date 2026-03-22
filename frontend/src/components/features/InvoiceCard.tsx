import { FileText, CheckCircle, XCircle, ChevronRight, AlertTriangle, Clock, RotateCcw } from 'lucide-react';
import { Invoice, PopulatedCustomer } from '../../types';

interface InvoiceCardProps {
  invoice: Invoice;
  customerName?: string;
  onClick: () => void;
}

export default function InvoiceCard({ invoice, customerName, onClick }: InvoiceCardProps) {
  const resolvedName =
    customerName ??
    (typeof invoice.customerId === 'object'
      ? (invoice.customerId as PopulatedCustomer).name
      : 'Customer');

  const isOverdue =
    (invoice.status === 'unpaid' || invoice.status === 'partially_paid') &&
    invoice.dueDate &&
    new Date(invoice.dueDate) < new Date();

  const statusConfig = {
    unpaid: {
      Icon: FileText,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-50',
      chip: 'bg-orange-100 text-orange-700',
      label: 'Unpaid',
    },
    partially_paid: {
      Icon: Clock,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50',
      chip: 'bg-amber-100 text-amber-700',
      label: 'Partial',
    },
    paid: {
      Icon: CheckCircle,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-50',
      chip: 'bg-green-100 text-green-700',
      label: 'Paid',
    },
    cancelled: {
      Icon: XCircle,
      iconColor: 'text-gray-400',
      iconBg: 'bg-gray-100',
      chip: 'bg-gray-100 text-gray-500',
      label: 'Cancelled',
    },
    returned: {
      Icon: RotateCcw,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-50',
      chip: 'bg-purple-100 text-purple-700',
      label: 'Returned',
    },
  } as const;

  const cfg = statusConfig[invoice.status];
  const { Icon } = cfg;

  const paidAmount = invoice.paidAmount ?? 0;
  const showPartialProgress = invoice.status === 'partially_paid' && paidAmount > 0;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border-b border-gray-50 text-left active:bg-gray-50"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
        <Icon size={18} className={cfg.iconColor} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-semibold text-gray-800 text-sm truncate">{invoice.invoiceNumber}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.chip}`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate">{resolvedName}</p>
        {showPartialProgress && (
          <p className="text-xs text-amber-600 mt-0.5">
            ₹{paidAmount.toLocaleString('en-IN')} of ₹{invoice.totalAmount.toLocaleString('en-IN')} paid
          </p>
        )}
        {invoice.dueDate && (
          <p className={`text-xs flex items-center gap-1 mt-0.5 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
            {isOverdue && <AlertTriangle size={11} />}
            Due {new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>

      <div className="text-right flex-shrink-0">
        <p className="font-bold text-gray-800 text-sm">
          ₹{invoice.totalAmount.toLocaleString('en-IN')}
        </p>
        {showPartialProgress && (
          <p className="text-xs text-amber-500 mt-0.5">
            ₹{(invoice.totalAmount - paidAmount).toLocaleString('en-IN')} left
          </p>
        )}
        <ChevronRight size={16} className="text-gray-300 ml-auto mt-1" />
      </div>
    </button>
  );
}
