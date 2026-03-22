import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Home, Check } from 'lucide-react';

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  // Razorpay passes razorpay_payment_link_id, razorpay_payment_id etc as query params
  const paymentLinkId = searchParams.get('razorpay_payment_link_id');
  const paymentId = searchParams.get('razorpay_payment_id');

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      {/* Success animation */}
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce-once">
        <CheckCircle size={56} className="text-green-500" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
      <p className="text-gray-400 text-sm mb-2">
        Payment received. Ledger automatically updated.
      </p>

      {paymentId && (
        <p className="text-xs text-gray-300 font-mono mb-6">
          Ref: {paymentId}
        </p>
      )}

      <div className="bg-green-50 border border-green-100 rounded-2xl px-6 py-4 mb-8 w-full max-w-xs">
        <p className="text-green-700 text-sm font-medium flex items-center justify-center gap-1.5">
          <Check size={15} className="flex-shrink-0" />
          Transaction recorded in your khata
        </p>
      </div>

      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 bg-brand-500 text-white px-8 py-3 rounded-xl font-semibold"
      >
        <Home size={18} />
        Go to Dashboard
      </button>

      <p className="text-xs text-gray-300 mt-4">
        Redirecting in {countdown}s...
      </p>
    </div>
  );
}
