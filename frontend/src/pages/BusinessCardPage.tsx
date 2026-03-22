import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Share2, Phone, Mail, MapPin, Globe } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { BUSINESS_CATEGORIES } from '../types';

const CARD_W = 800;
const CARD_H = 440;

const BG_GRADIENTS = [
  { id: 'indigo', from: '#4338ca', to: '#7c3aed', label: 'Indigo' },
  { id: 'emerald', from: '#065f46', to: '#0891b2', label: 'Teal' },
  { id: 'rose', from: '#be123c', to: '#ea580c', label: 'Crimson' },
  { id: 'amber', from: '#92400e', to: '#b45309', label: 'Amber' },
  { id: 'slate', from: '#1e293b', to: '#334155', label: 'Dark' },
];

function drawCard(
  ctx: CanvasRenderingContext2D,
  user: { businessName: string; ownerName: string; phone?: string; email: string; businessAddress?: string; businessCategory?: string; upiId?: string },
  gradient: { from: string; to: string }
) {
  const W = CARD_W, H = CARD_H;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, gradient.from);
  bg.addColorStop(1, gradient.to);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 24);
  ctx.fill();

  // Decorative circle top-right
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(W - 60, -40, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W + 20, H - 40, 140, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Business name
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.fillText(user.businessName || 'My Business', 48, 90);

  // Category chip
  const catLabel = BUSINESS_CATEGORIES.find((c) => c.id === user.businessCategory)?.label ?? '';
  if (catLabel) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(48, 110, ctx.measureText(catLabel).width + 24, 32, 16);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(catLabel, 60, 132);
  }

  // Divider
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 168);
  ctx.lineTo(W - 48, 168);
  ctx.stroke();
  ctx.restore();

  // Owner name
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(user.ownerName || '', 48, 215);

  // Contact info rows
  const contacts: { icon: string; text: string }[] = [];
  if (user.phone) contacts.push({ icon: '📞', text: user.phone });
  contacts.push({ icon: '✉️', text: user.email });
  if (user.businessAddress) contacts.push({ icon: '📍', text: user.businessAddress });
  if (user.upiId) contacts.push({ icon: '💳', text: `UPI: ${user.upiId}` });

  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  contacts.slice(0, 3).forEach((c, i) => {
    ctx.fillText(`${c.icon}  ${c.text}`, 48, 258 + i * 30);
  });

  // UdhaariBook watermark
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Made with UdhaariBook', W - 200, H - 20);
  ctx.restore();
}

export default function BusinessCardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedGrad, setSelectedGrad] = useState(BG_GRADIENTS[0]);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !user) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CARD_W, CARD_H);
    drawCard(ctx, user, selectedGrad);
  }, [user, selectedGrad]);

  const getBlob = (): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvasRef.current?.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
    });

  const handleDownload = async () => {
    const blob = await getBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${user?.businessName ?? 'business'}-card.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    setShareLoading(true);
    try {
      const blob = await getBlob();
      const file = new File([blob], 'business-card.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: user?.businessName });
      } else {
        await handleDownload();
      }
    } finally {
      setShareLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Digital Business Card</h1>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-5">
        {/* Canvas preview */}
        <div className="overflow-hidden rounded-2xl shadow-lg">
          <canvas
            ref={canvasRef}
            width={CARD_W}
            height={CARD_H}
            className="w-full"
            style={{ aspectRatio: `${CARD_W}/${CARD_H}` }}
          />
        </div>

        {/* Color picker */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Card Color</p>
          <div className="flex gap-3">
            {BG_GRADIENTS.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGrad(g)}
                className={`w-10 h-10 rounded-xl border-4 transition-all ${selectedGrad.id === g.id ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                title={g.label}
              />
            ))}
          </div>
        </div>

        {/* Info preview */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <p className="font-semibold text-gray-900">{user.businessName || '(No business name)'}</p>
          {user.ownerName && <p className="text-gray-600 text-sm">{user.ownerName}</p>}
          <div className="grid grid-cols-1 gap-1.5 mt-2">
            {user.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Phone className="w-3.5 h-3.5" /> {user.phone}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Mail className="w-3.5 h-3.5" /> {user.email}
            </div>
            {user.businessAddress && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin className="w-3.5 h-3.5" /> {user.businessAddress}
              </div>
            )}
            {user.upiId && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Globe className="w-3.5 h-3.5" /> UPI: {user.upiId}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Update your info in Settings to update the card
          </p>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 pb-6">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-semibold"
          >
            <Download className="w-4 h-4" />
            Download PNG
          </button>
          <button
            onClick={handleShare}
            disabled={shareLoading}
            className="flex items-center justify-center gap-2 py-3 bg-gray-800 text-white rounded-xl font-semibold disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            {shareLoading ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}
