import { useEffect, useState } from 'react';
import { Bell, Send, AlertTriangle, Mail, MessageSquare, MessageCircle, CheckCircle, XCircle, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import api, { getApiErrorMessage } from '../lib/api';
import { Reminder, PopulatedCustomer, Customer } from '../types';
import { useCustomerStore } from '../store/customerStore';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ReminderSheet from '../components/features/ReminderSheet';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/layout/PageHeader';

type HistoryFilter = 'all' | 'manual' | 'auto';

export default function RemindersPage() {
  const { customers, loadCustomers } = useCustomerStore();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bulkSending, setBulkSending] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  useEffect(() => {
    Promise.all([loadCustomers(), loadReminders()]);
  }, []);

  const loadReminders = async () => {
    try {
      const res = await api.get<Reminder[]>('/api/reminders/history');
      setReminders(res.data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load reminder history'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkSend = async () => {
    setShowBulkConfirm(false);
    setBulkSending(true);
    try {
      const res = await api.post<{ sent: number; failed: number; total: number }>('/api/reminders/bulk');
      if (res.data.failed > 0) {
        toast(`Sent: ${res.data.sent}  Failed: ${res.data.failed}`, { icon: <Mail size={16} className="text-blue-500" /> });
      } else {
        toast.success(`${res.data.sent} reminders sent!`);
      }
      loadReminders();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Bulk send failed'));
    } finally {
      setBulkSending(false);
    }
  };

  const customersWithDues = customers.filter((c) => c.totalOutstanding > 0);
  const customersWithEmail = customersWithDues.filter((c) => c.email);

  const ChannelIcon = ({ channel }: { channel: string }) => {
    if (channel === 'email') return <Mail size={15} className="text-blue-500" />;
    if (channel === 'sms') return <MessageSquare size={15} className="text-purple-500" />;
    if (channel === 'whatsapp') return <MessageCircle size={15} className="text-green-500" />;
    return <MessageCircle size={15} className="text-gray-400" />;
  };

  const getCustomerName = (customerId: Reminder['customerId']): string => {
    if (typeof customerId === 'object' && customerId !== null) {
      return (customerId as PopulatedCustomer).name;
    }
    return 'Customer';
  };

  const filteredReminders = reminders.filter((r) => {
    if (historyFilter === 'all') return true;
    return r.triggerType === historyFilter;
  });

  const manualCount = reminders.filter((r) => r.triggerType === 'manual').length;
  const autoCount = reminders.filter((r) => r.triggerType === 'auto').length;

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Reminders" />
      <div className="bg-white px-4 pb-4 border-b border-gray-100">
        {/* Bulk send card */}
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-800">Bulk Email Reminder</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {customersWithEmail.length} customer{customersWithEmail.length !== 1 ? 's' : ''} will receive email
                {customersWithDues.length - customersWithEmail.length > 0 && (
                  <span className="text-orange-400"> ({customersWithDues.length - customersWithEmail.length} no email)</span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowBulkConfirm(true)}
              disabled={bulkSending || customersWithEmail.length === 0}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex-shrink-0"
            >
              {bulkSending ? (
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Send size={15} />
              )}
              {bulkSending ? 'Sending...' : 'Send All'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Individual reminders */}
        {customersWithDues.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5 bg-gray-50">
              Send Reminder
            </p>
            {customersWithDues.map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between px-4 py-3.5 bg-white border-b border-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center font-bold text-red-600">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
                    <p className="text-xs text-red-500 font-medium">
                      ₹{c.totalOutstanding.toLocaleString('en-IN')} pending
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(c)}
                  className="flex items-center gap-1.5 bg-brand-50 text-brand-600 px-3 py-2 rounded-xl text-xs font-semibold"
                >
                  <Bell size={13} />
                  Remind
                </button>
              </div>
            ))}
          </div>
        )}

        {/* History section */}
        <div>
          {/* Filter tabs */}
          <div className="flex items-center bg-gray-50 border-b border-gray-100">
            {([
              { key: 'all' as HistoryFilter, label: 'All', count: reminders.length },
              { key: 'manual' as HistoryFilter, label: 'Manual', count: manualCount },
              { key: 'auto' as HistoryFilter, label: 'Auto', count: autoCount },
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setHistoryFilter(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                  historyFilter === key
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    historyFilter === key ? 'bg-brand-100 text-brand-600' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : filteredReminders.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={
                historyFilter === 'auto' ? 'No auto reminders yet'
                : historyFilter === 'manual' ? 'No manual reminders sent'
                : 'No reminders sent yet'
              }
              description={historyFilter === 'auto' ? 'Auto reminders will appear here when triggered' : 'Send individual or bulk reminders above'}
            />
          ) : (
            filteredReminders.map((r) => (
              <div key={r._id} className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-gray-50">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${r.status === 'sent' ? 'bg-green-100' : 'bg-red-100'}`}>
                  <ChannelIcon channel={r.channel} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 text-sm truncate">
                      {getCustomerName(r.customerId)}
                    </p>
                    <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      r.triggerType === 'auto'
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {r.triggerType === 'auto' ? '⚡ Auto' : <><User size={8} className="inline" /> Manual</>}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 capitalize flex items-center gap-1 mt-0.5">
                    <span className="capitalize">{r.channel}</span>
                    {' · '}
                    {r.status === 'sent' ? (
                      <span className="text-green-500 flex items-center gap-0.5">
                        <CheckCircle size={11} /> Sent
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-0.5">
                        <XCircle size={11} /> Failed
                      </span>
                    )}
                    {r.errorMessage ? ` — ${r.errorMessage}` : ''}
                  </p>
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0">
                  {formatDistanceToNow(new Date(r.sentAt), { addSuffix: true })}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bulk Confirm Modal */}
      <Modal open={showBulkConfirm} onClose={() => setShowBulkConfirm(false)} title="Send Bulk Reminder?">
        <div className="flex gap-3 mb-5">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-orange-500" />
          </div>
          <div>
            <p className="text-gray-800 font-medium text-sm mb-2">
              Yeh customers ko email reminder jayega:
            </p>
            <ul className="space-y-1">
              <li className="text-sm text-gray-600">
                • <strong>{customersWithDues.length}</strong> customers with outstanding
              </li>
              <li className="text-sm text-gray-600">
                • <strong>{customersWithEmail.length}</strong> have email (will receive)
              </li>
              {customersWithDues.length - customersWithEmail.length > 0 && (
                <li className="text-sm text-orange-500">
                  • {customersWithDues.length - customersWithEmail.length} skip honge (no email)
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowBulkConfirm(false)} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleBulkSend}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Send to {customersWithEmail.length}
          </button>
        </div>
      </Modal>

      {/* Individual reminder sheet */}
      {selectedCustomer && (
        <ReminderSheet
          open={!!selectedCustomer}
          onClose={() => {
            setSelectedCustomer(null);
            loadReminders();
          }}
          customer={selectedCustomer}
        />
      )}
    </div>
  );
}
