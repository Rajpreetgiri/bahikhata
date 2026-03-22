import { useState } from 'react';
import adminApi, { getAdminApiError } from '../../lib/adminApi';
import { Send, BellRing } from 'lucide-react';

export default function AdminNotificationsPage() {
  const [merchantId, setMerchantId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('admin_broadcast');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sent: number } | null>(null);
  const [error, setError] = useState('');

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const payload: Record<string, string> = { title: title.trim(), body: body.trim(), type };
      if (merchantId.trim()) payload.merchantId = merchantId.trim();
      const res = await adminApi.post('/api/admin/notifications/send', payload);
      setResult(res.data);
      setTitle('');
      setBody('');
      setMerchantId('');
    } catch (err) {
      setError(getAdminApiError(err, 'Failed to send notification'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-white">Send Notifications</h1>
        <p className="text-gray-400 text-sm mt-0.5">Broadcast to all merchants or target a specific merchant</p>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
        <div className="flex items-center gap-3 text-indigo-400">
          <BellRing className="w-5 h-5" />
          <span className="text-sm font-semibold">Compose Notification</span>
        </div>

        {result && (
          <div className="bg-green-900/40 border border-green-700 text-green-300 text-sm rounded-lg px-4 py-3">
            Notification sent to {result.sent} merchant{result.sent !== 1 ? 's' : ''}
          </div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Merchant ID <span className="text-gray-500 font-normal">(leave blank to broadcast to ALL)</span>
            </label>
            <input
              type="text"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="MongoDB ObjectId of merchant (optional)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Notification body text…"
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm resize-none"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{body.length}/500</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 w-full"
            >
              <option value="admin_broadcast">Admin Broadcast</option>
              <option value="system_alert">System Alert</option>
              <option value="feature_update">Feature Update</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-3 text-sm text-gray-400 border border-gray-700">
            {merchantId.trim()
              ? 'This notification will be sent to the specified merchant only.'
              : 'This notification will be broadcast to ALL onboarded merchants.'}
          </div>

          <button
            type="submit"
            disabled={loading || !title.trim() || !body.trim()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors text-sm"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Sending…' : 'Send Notification'}
          </button>
        </form>
      </div>
    </div>
  );
}
