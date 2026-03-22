import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, CheckCircle, XCircle } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { User } from '../types';

export default function StaffInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const token = searchParams.get('token');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError('Invalid invite link');
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ token: string; user: User }>('/api/staff/accept-invite', {
        inviteToken: token,
        name: name.trim() || undefined,
      });
      setSuccess(true);
      // Staff accounts don't have refreshToken in this flow; store access token only
      login(res.data.token, '', res.data.user);
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to accept invite');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900">Invalid Invite Link</h1>
          <p className="text-gray-500 mt-2">This link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900">Welcome to the team!</h1>
          <p className="text-gray-500 mt-2">Redirecting you to the dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Staff Invitation</h1>
            <p className="text-gray-500 text-sm mt-1">You've been invited to join a business on UdhaariBook</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleAccept}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
          >
            {loading ? 'Accepting...' : 'Accept Invitation'}
          </button>
        </div>
      </div>
    </div>
  );
}
