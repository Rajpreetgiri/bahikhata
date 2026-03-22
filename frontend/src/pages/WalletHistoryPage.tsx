import { useEffect } from 'react';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { useWalletStore } from '../store/walletStore';
import PageHeader from '../components/layout/PageHeader';
import Spinner from '../components/ui/Spinner';

const CHANNEL_LABELS: Record<string, string> = {
  razorpay: 'Razorpay Top-up',
  sms: 'SMS Reminder',
  whatsapp: 'WhatsApp Reminder',
  pack_purchase: 'Pack Purchase',
  refund: 'Refund',
};

export default function WalletHistoryPage() {
  const { history, wallet, loadHistory, loadWallet, isLoading } = useWalletStore();

  useEffect(() => {
    loadHistory();
    loadWallet();
  }, []);

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Wallet History" />

      {/* Balance bar */}
      {wallet && (
        <div className="bg-brand-500 px-5 py-4">
          <p className="text-brand-200 text-xs font-medium">Current Balance</p>
          <p className="text-white text-2xl font-bold">₹{wallet.balance.toFixed(2)}</p>
          {wallet.activePack && (
            <p className="text-brand-200 text-xs mt-1">
              + {wallet.activePack.remaining} SMS pack credits remaining
            </p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size={32} /></div>
        ) : history.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-16">No transactions yet</p>
        ) : (
          history.map((tx) => (
            <div key={tx._id} className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-gray-50">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                tx.type === 'credit' ? 'bg-green-50' : 'bg-red-50'
              }`}>
                {tx.type === 'credit'
                  ? <ArrowUpCircle size={20} className="text-green-500" />
                  : <ArrowDownCircle size={20} className="text-red-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{tx.description}</p>
                <p className="text-xs text-gray-400">
                  {CHANNEL_LABELS[tx.channel] ?? tx.channel} ·{' '}
                  {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${tx.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400">Bal: ₹{tx.balanceAfter.toFixed(2)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
