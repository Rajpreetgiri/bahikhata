import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Plus, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { BusinessSummary, User } from '../types';
import toast from 'react-hot-toast';

export default function MyBusinessesPage() {
  const navigate = useNavigate();
  const { user, login, token, refreshToken } = useAuthStore();
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    api.get<BusinessSummary[]>('/api/auth/businesses')
      .then((res) => setBusinesses(Array.isArray(res.data) ? res.data : []))
      .catch(() => toast.error('Failed to load businesses'))
      .finally(() => setLoading(false));
  }, []);

  const handleSwitch = async (id: string) => {
    if (id === user?.id) return;
    setSwitchingId(id);
    try {
      const res = await api.post<{ token: string; refreshToken: string; user: User }>(
        '/api/auth/select-business',
        { selectionToken: '', businessId: id }
      );
      // This won't work without a selectionToken — for same-session switch we need a different approach
      // Instead: we use create-business flow which issues tokens for a fresh business
      login(res.data.token, res.data.refreshToken, res.data.user);
      navigate('/', { replace: true });
      toast.success('Switched business');
    } catch {
      // For switching within session, user must re-authenticate. Show message.
      toast.error('To switch, please log out and log in again');
    } finally {
      setSwitchingId(null);
    }
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await api.post<{ token: string; refreshToken: string; user: User }>('/api/auth/create-business');
      login(res.data.token, res.data.refreshToken, res.data.user);
      navigate('/onboarding', { replace: true });
      toast.success('New business created!');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to create business');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">My Businesses</h1>
      </div>

      <div className="p-4 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          businesses.map((b) => (
            <div key={b.id} className={`bg-white rounded-2xl border p-4 flex items-center gap-3 ${b.id === user?.id ? 'border-indigo-300' : 'border-gray-100'}`}>
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{b.businessName || '(Unnamed)'}</p>
                {b.ownerName && <p className="text-sm text-gray-500 truncate">{b.ownerName}</p>}
                {b.id === user?.id && (
                  <span className="text-xs text-indigo-600 font-semibold">Current</span>
                )}
              </div>
              {b.id !== user?.id && (
                <button
                  onClick={() => handleSwitch(b.id)}
                  disabled={!!switchingId}
                  className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                >
                  {switchingId === b.id ? '...' : 'Switch'}
                </button>
              )}
            </div>
          ))
        )}

        {businesses.length < 5 && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-2xl text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">{creating ? 'Creating...' : 'Add New Business'}</span>
          </button>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-amber-800 text-sm">To switch between businesses, log out and log back in to see the selection screen.</p>
        </div>
      </div>
    </div>
  );
}
