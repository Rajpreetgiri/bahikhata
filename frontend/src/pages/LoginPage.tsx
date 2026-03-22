import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      await api.post('/api/auth/send-otp', { email: data.email });
      toast.success('OTP sent to your email!');
      navigate('/verify-otp', { state: { email: data.email } });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center px-6 py-12">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-white text-3xl font-bold">U</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">UdhaariBook</h1>
        <p className="text-gray-400 mt-1 text-sm">Digital khata — track, remind, collect</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-sm mx-auto w-full">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              {...register('email')}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              placeholder="you@example.com"
              className="input-field pl-11"
              autoFocus
            />
          </div>
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? 'Sending OTP...' : 'Get OTP'}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-8">
        We'll send a one-time password to your email.<br />No password needed.
      </p>
    </div>
  );
}
