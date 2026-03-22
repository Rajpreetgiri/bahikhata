import { create } from 'zustand';
import { persist } from 'zustand/middleware';

async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface PinState {
  pinHash: string | null;    // SHA-256 of PIN (stored)
  isLocked: boolean;
  isPinEnabled: boolean;
  setPin: (pin: string) => Promise<void>;
  disablePin: () => void;
  verifyPin: (pin: string) => Promise<boolean>;
  lock: () => void;
  unlock: () => void;
}

export const usePinStore = create<PinState>()(
  persist(
    (set, get) => ({
      pinHash: null,
      isLocked: false,
      isPinEnabled: false,

      setPin: async (pin) => {
        const hash = await sha256(pin);
        set({ pinHash: hash, isPinEnabled: true, isLocked: false });
      },

      disablePin: () => {
        set({ pinHash: null, isPinEnabled: false, isLocked: false });
      },

      verifyPin: async (pin) => {
        const { pinHash } = get();
        if (!pinHash) return false;
        const hash = await sha256(pin);
        const isMatch = hash === pinHash;
        if (isMatch) set({ isLocked: false });
        return isMatch;
      },

      lock: () => {
        const { isPinEnabled } = get();
        if (isPinEnabled) set({ isLocked: true });
      },

      unlock: () => set({ isLocked: false }),
    }),
    {
      name: 'udhaari-pin',
      partialize: (state) => ({
        pinHash: state.pinHash,
        isPinEnabled: state.isPinEnabled,
      }),
    }
  )
);
