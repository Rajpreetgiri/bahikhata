/** Dynamically load Razorpay checkout script and open payment modal. */
export function openRazorpayCheckout(options: {
  keyId: string;
  orderId: string;
  amount: number; // rupees
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onFailure?: (error: unknown) => void;
}): void {
  const loadScript = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if (document.getElementById('razorpay-checkout-js')) { resolve(); return; }
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.body.appendChild(script);
    });

  loadScript().then(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Razorpay = (window as any).Razorpay;
    const rzp = new Razorpay({
      key: options.keyId,
      order_id: options.orderId,
      amount: options.amount * 100,
      currency: 'INR',
      name: options.name,
      description: options.description,
      prefill: options.prefill ?? {},
      theme: { color: '#6366f1' },
      handler: options.onSuccess,
      modal: {
        ondismiss: () => options.onFailure?.('dismissed'),
      },
    });
    rzp.on('payment.failed', (resp: unknown) => options.onFailure?.(resp));
    rzp.open();
  }).catch((err) => options.onFailure?.(err));
}
