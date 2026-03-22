import { useState } from 'react';
import { Mail, MessageCircle, Send, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import api, { getApiErrorMessage } from '../../lib/api';
import { Customer } from '../../types';
import { useAuthStore } from '../../store/authStore';

interface ReminderSheetProps {
  open: boolean;
  onClose: () => void;
  customer: Customer;
  paymentLink?: string;
}

export default function ReminderSheet({ open, onClose, customer, paymentLink }: ReminderSheetProps) {
  const [sending, setSending] = useState<string | null>(null);
  const { user } = useAuthStore();

  const sendEmail = async () => {
    if (!customer.email) { toast.error('No email on file for this customer'); return; }
    setSending('email');
    try {
      await api.post('/api/reminders/send', { customerId: customer._id, channels: ['email'] });
      toast.success('Email reminder sent!');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to send email'));
    } finally {
      setSending(null);
    }
  };

  const sendSMS = async () => {
    if (!customer.phone) { toast.error('No phone number on file'); return; }
    setSending('sms');
    try {
      await api.post('/api/reminders/send', { customerId: customer._id, channels: ['sms'] });
      toast.success('SMS reminder sent!');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to send SMS'));
    } finally {
      setSending(null);
    }
  };

  const sendWhatsApp = () => {
    if (!customer.phone) { toast.error('No phone number on file'); return; }

    const msg =
      `Namaste ${customer.name} ji 🙏\n\n` +
      `*${user?.businessName ?? 'Hum'}* ki taraf se yaad dila raha hoon.\n\n` +
      `Outstanding balance: *₹${customer.totalOutstanding.toLocaleString('en-IN')}*\n\n` +
      (paymentLink ? `Online pay karein: ${paymentLink}\n\n` : '') +
      `Kripaya jald se jald payment karein. Shukriya! 🙏`;

    const cleaned = customer.phone.replace(/\D/g, '').replace(/^0+/, '');
    const e164 = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
    window.open(`https://wa.me/${e164}?text=${encodeURIComponent(msg)}`, '_blank');

    // Log reminder intent on backend (fire-and-forget)
    api.post('/api/reminders/send', { customerId: customer._id, channels: ['whatsapp'] }).catch(() => {});
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Remind ${customer.name}`}>
      <p className="text-sm text-gray-500 mb-5">
        Outstanding: <span className="text-red-600 font-semibold">₹{customer.totalOutstanding.toLocaleString('en-IN')}</span>
      </p>

      <div className="space-y-3">
        {/* Email — Free */}
        <button
          onClick={sendEmail}
          disabled={sending === 'email' || !customer.email}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Mail size={18} className="text-blue-600" />
          </div>
          <div className="text-left flex-1">
            <p className="font-semibold text-gray-800">Email Reminder</p>
            <p className="text-xs text-gray-400">{customer.email ?? 'No email on file'} · Free</p>
          </div>
          {sending === 'email'
            ? <div className="animate-spin rounded-full border-2 border-blue-200 border-t-blue-500 w-5 h-5" />
            : <Send size={16} className="text-gray-300" />}
        </button>

        {/* WhatsApp — Free */}
        <button
          onClick={sendWhatsApp}
          disabled={!customer.phone}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:bg-green-50 hover:border-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <MessageCircle size={18} className="text-green-600" />
          </div>
          <div className="text-left flex-1">
            <p className="font-semibold text-gray-800">WhatsApp Reminder</p>
            <p className="text-xs text-gray-400">{customer.phone ?? 'No phone on file'} · Free · Opens WhatsApp</p>
          </div>
          <Send size={16} className="text-gray-300" />
        </button>

        {/* SMS — Uses pack credits */}
        <button
          onClick={sendSMS}
          disabled={sending === 'sms' || !customer.phone}
          className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:bg-purple-50 hover:border-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            <MessageSquare size={18} className="text-purple-600" />
          </div>
          <div className="text-left flex-1">
            <p className="font-semibold text-gray-800">SMS Reminder</p>
            <p className="text-xs text-gray-400">{customer.phone ?? 'No phone on file'} · Uses SMS pack / wallet</p>
          </div>
          {sending === 'sms'
            ? <div className="animate-spin rounded-full border-2 border-purple-200 border-t-purple-500 w-5 h-5" />
            : <Send size={16} className="text-gray-300" />}
        </button>
      </div>
    </Modal>
  );
}
