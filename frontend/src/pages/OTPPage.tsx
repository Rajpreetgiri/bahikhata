import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function OTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email as string | undefined;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { login } = useAuthStore();

  useEffect(() => {
    if (!email) { navigate('/login'); return; }
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [email, navigate]);

  const handleInput = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return;

    // Handle paste / autocomplete — distribute digits across boxes
    if (digits.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < digits.length && index + i < 6; i++) {
        newOtp[index + i] = digits[i];
      }
      setOtp(newOtp);
      // Focus the last filled box (or last box)
      const nextFocus = Math.min(index + digits.length, 5);
      inputRefs.current[nextFocus]?.focus();
      // Auto-submit if all 6 digits filled
      if (newOtp.every((d) => d)) handleVerify(newOtp.join(''));
      return;
    }

    // Single digit typed
    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);
    if (digits && index < 5) inputRefs.current[index + 1]?.focus();
    if (digits && index === 5 && newOtp.every((d) => d)) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const otpValue = code ?? otp.join('');
    if (otpValue.length !== 6) { toast.error('Enter all 6 digits'); return; }

    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/verify-otp', { email, otp: otpValue });

      // Multi-business: user has multiple businesses, must pick one
      if (res.data.needsBusinessSelect) {
        navigate('/select-business', {
          state: { selectionToken: res.data.selectionToken, businesses: res.data.businesses },
        });
        return;
      }

      login(res.data.token, res.data.refreshToken, res.data.user);
      toast.success('Logged in!');
      if (res.data.isNewUser || !res.data.user.isOnboarded) {
        navigate('/onboarding');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await api.post('/api/auth/send-otp', { email });
      toast.success('New OTP sent!');
      setResendCooldown(30);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch {
      toast.error('Failed to resend OTP');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 py-12">
      <button onClick={() => navigate('/login')} className="flex items-center gap-2 text-gray-500 mb-10 self-start">
        <ArrowLeft size={20} />
        <span className="text-sm font-medium">Back</span>
      </button>

      <div className="max-w-sm mx-auto w-full flex-1">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Enter OTP</h1>
        <p className="text-sm text-gray-400 mb-8">
          We sent a 6-digit code to<br />
          <span className="font-medium text-gray-700">{email}</span>
        </p>

        {/* OTP inputs */}
        <div className="flex gap-3 justify-center mb-8">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
                if (pasted) handleInput(i, pasted);
              }}
              onFocus={(e) => e.target.select()}
              className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl focus:outline-none transition-colors ${
                digit
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 bg-white text-gray-900'
              } focus:border-brand-500`}
            />
          ))}
        </div>

        <button
          onClick={() => handleVerify()}
          disabled={isLoading || otp.some((d) => !d)}
          className="btn-primary mb-5"
        >
          {isLoading ? 'Verifying...' : 'Verify OTP'}
        </button>

        <button
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="w-full text-sm text-center text-gray-400 disabled:opacity-50"
        >
          {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
        </button>
      </div>
    </div>
  );
}
