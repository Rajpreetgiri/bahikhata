import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Plus } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { BusinessSummary, User } from '../types';

interface LocationState {
  selectionToken: string;
  businesses: BusinessSummary[];
}

export default function BusinessSelectPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const state = location.state as LocationState | null;

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!state?.selectionToken) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleSelect = async (businessId: string) => {
    setLoading(businessId);
    setError('');
    try {
      const res = await api.post<{ token: string; refreshToken: string; user: User }>(
        '/api/auth/select-business',
        { selectionToken: state.selectionToken, businessId }
      );
      const { token, refreshToken, user } = res.data;
      login(token, refreshToken, user);
      navigate(user.isOnboarded ? '/' : '/onboarding', { replace: true });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Something went wrong');
    } finally {
      setLoading(null);
    }
  };

  const handleCreateNew = async () => {
    // Redirect to OTP page with createNew flag — user will need to verify OTP again then we create a new business
    navigate('/login', { state: { createNewBusiness: true } });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Select Business</h1>
          <p className="text-gray-500 mt-1 text-sm">You have multiple businesses. Which one would you like to open?</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          {state.businesses.map((b, idx) => (
            <button
              key={b.id}
              onClick={() => handleSelect(b.id)}
              disabled={!!loading}
              className={`w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 transition-colors disabled:opacity-60
                ${idx < state.businesses.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{b.businessName}</p>
                {b.ownerName && <p className="text-sm text-gray-500 truncate">{b.ownerName}</p>}
                {!b.isOnboarded && (
                  <span className="text-xs text-amber-600 font-medium">Setup pending</span>
                )}
              </div>
              {loading === b.id ? (
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleCreateNew}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-2xl text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add New Business</span>
        </button>
      </div>
    </div>
  );
}
