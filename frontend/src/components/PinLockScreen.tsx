import { useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import { usePinStore } from '../store/pinStore';

export default function PinLockScreen() {
  const { verifyPin } = usePinStore();
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleDigit = async (d: string) => {
    if (digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      const ok = await verifyPin(next.join(''));
      if (!ok) {
        setShake(true);
        setTimeout(() => { setShake(false); setDigits([]); setError('Wrong PIN, try again'); }, 600);
      } else {
        setError('');
      }
    } else {
      setError('');
    }
  };

  const handleBackspace = () => setDigits((d) => d.slice(0, -1));

  const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-50">
      <div className="flex flex-col items-center gap-8 w-full max-w-xs px-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white text-xl font-semibold">App Locked</h1>
          <p className="text-gray-400 text-sm">Enter your 4-digit PIN</p>
        </div>

        {/* Dot indicators */}
        <div className={`flex gap-4 ${shake ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-colors ${
                i < digits.length ? 'bg-indigo-500 border-indigo-500' : 'border-gray-500'
              }`}
            />
          ))}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {PAD.map((key, idx) => {
            if (key === '') return <div key={idx} />;
            return (
              <button
                key={idx}
                onClick={() => key === '⌫' ? handleBackspace() : handleDigit(key)}
                className={`h-16 rounded-2xl text-xl font-semibold transition-colors
                  ${key === '⌫'
                    ? 'bg-transparent text-gray-400 flex items-center justify-center'
                    : 'bg-gray-800 text-white active:bg-gray-700'}`}
              >
                {key === '⌫' ? <Delete className="w-5 h-5" /> : key}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
