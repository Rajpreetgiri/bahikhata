import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Store, UserCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { BusinessCategoryId } from '../types';
import { CATEGORY_CONFIG, getCategoryConfig } from '../config/categories';

interface StepData {
  ownerName: string;
  businessCategory: BusinessCategoryId | '';
  businessName: string;
  phone: string;
  businessAddress: string;
  gstNumber: string;
}

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { updateProfile, user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<StepData>({
    ownerName: user?.ownerName ?? '',
    businessCategory: (user?.businessCategory as BusinessCategoryId) ?? '',
    businessName: user?.businessName ?? '',
    phone: user?.phone ?? '',
    businessAddress: user?.businessAddress ?? '',
    gstNumber: user?.gstNumber ?? '',
  });

  const update = (key: keyof StepData, value: string) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const canProceed = () => {
    if (step === 1) return data.ownerName.trim().length >= 2;
    if (step === 2) return data.businessCategory !== '';
    if (step === 3) return data.businessName.trim().length >= 2;
    return false;
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateProfile({
        ownerName: data.ownerName.trim(),
        businessCategory: data.businessCategory as BusinessCategoryId,
        businessName: data.businessName.trim(),
        phone: data.phone.trim(),
        businessAddress: data.businessAddress.trim(),
        gstNumber: data.gstNumber.trim().toUpperCase(),
        isOnboarded: true,
      });
      toast.success('Welcome to UdhaariBook!');
      navigate('/');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const selectedCategory = getCategoryConfig(data.businessCategory);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-brand-500 transition-all duration-500"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col px-6 py-8 max-w-md mx-auto w-full">
        {/* Back + Steps */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={handleBack}
            className={`p-2 rounded-xl transition-colors ${step === 1 ? 'invisible' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-sm font-medium text-gray-400">
            Step {step} of {TOTAL_STEPS}
          </span>
          <div className="w-9" />
        </div>

        {/* Step 1 — Owner Name */}
        {step === 1 && (
          <div className="flex-1 flex flex-col">
            <div className="mb-8">
              <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
                <UserCircle size={28} className="text-brand-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Aapka naam kya hai?
              </h1>
              <p className="text-gray-400 text-sm">
                Reminders aur reports pe yahi naam aayega
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Aapka Naam (Owner Name)
                </label>
                <input
                  value={data.ownerName}
                  onChange={(e) => update('ownerName', e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="input-field text-lg"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && canProceed() && handleNext()}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Business Category */}
        {step === 2 && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
                <Store size={24} className="text-brand-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Kaisa business hai?
              </h1>
              <p className="text-gray-400 text-sm">
                Apni category choose karo
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 overflow-y-auto flex-1 pb-4">
              {CATEGORY_CONFIG.map((cat) => {
                const isSelected = data.businessCategory === cat.id;
                const { Icon } = cat;
                return (
                  <button
                    key={cat.id}
                    onClick={() => update('businessCategory', cat.id)}
                    className={`relative flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 shadow-sm'
                        : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-brand-500 rounded-full flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSelected ? 'bg-brand-100' : cat.bgColor}`}>
                      <Icon size={18} className={isSelected ? 'text-brand-600' : cat.color} />
                    </div>
                    <span className={`text-xs font-medium text-center leading-tight ${isSelected ? 'text-brand-700' : 'text-gray-600'}`}>
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3 — Business Details */}
        {step === 3 && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              {selectedCategory && (
                <div className={`w-12 h-12 ${selectedCategory.bgColor} rounded-2xl flex items-center justify-center mb-4`}>
                  <selectedCategory.Icon size={24} className={selectedCategory.color} />
                </div>
              )}
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Business ki details
              </h1>
              <p className="text-gray-400 text-sm">
                Yeh reminders aur reports mein dikhega
              </p>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Business / Dukan ka Naam <span className="text-red-500">*</span>
                </label>
                <input
                  value={data.businessName}
                  onChange={(e) => update('businessName', e.target.value)}
                  placeholder="e.g. Sharma General Store"
                  className="input-field"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">+91</span>
                  <input
                    value={data.phone}
                    onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    type="tel"
                    inputMode="numeric"
                    placeholder="9876543210"
                    className="input-field pl-12"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Business Address <span className="text-gray-400 text-xs font-normal">(optional)</span>
                </label>
                <textarea
                  value={data.businessAddress}
                  onChange={(e) => update('businessAddress', e.target.value)}
                  placeholder="e.g. Shop No. 12, Main Market, Delhi - 110001"
                  className="input-field resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  GST Number <span className="text-gray-400 text-xs font-normal">(optional)</span>
                </label>
                <input
                  value={data.gstNumber}
                  onChange={(e) => update('gstNumber', e.target.value.toUpperCase())}
                  placeholder="e.g. 07AABCU9603R1ZX"
                  className="input-field font-mono tracking-wide"
                  maxLength={15}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="pt-4">
          {step < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="btn-primary flex items-center justify-center gap-2"
            >
              Aage Badho
              <ArrowRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!canProceed() || saving}
              className="btn-primary flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Shuru Karo!
                </>
              )}
            </button>
          )}

          {step === 3 && (
            <p className="text-center text-xs text-gray-400 mt-3">
              Address aur GST baad mein Settings se bhi add kar sakte ho
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
