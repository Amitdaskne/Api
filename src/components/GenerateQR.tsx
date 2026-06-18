import { useState, useEffect } from 'react';
import { generateUpiQrCode, buildUpiUrl } from '../utils/upi';
import { UserProfile, DecodedUpiContent } from '../types';
import { QrCode, Download, Copy, Check, Sparkles, Smartphone, ShieldCheck } from 'lucide-react';

interface GenerateQRProps {
  userProfile: UserProfile;
}

export default function GenerateQR({ userProfile }: GenerateQRProps) {
  const [upiId, setUpiId] = useState<string>(userProfile.upiId);
  const [payeeName, setPayeeName] = useState<string>(userProfile.name);
  const [amount, setAmount] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);

  useEffect(() => {
    // Prefill if userProfile toggles
    setUpiId(userProfile.upiId);
    setPayeeName(userProfile.name);
  }, [userProfile]);

  useEffect(() => {
    let active = true;
    async function updateQRCode() {
      if (!upiId) return;
      try {
        setGenerating(true);
        const params: DecodedUpiContent = {
          pa: upiId,
          pn: payeeName || 'Receiver',
          am: amount ? amount : undefined,
          tn: remarks ? remarks : undefined,
          cu: 'INR',
        };
        const url = await generateUpiQrCode(params);
        if (active) {
          setQrCodeUrl(url);
        }
      } catch (e) {
        console.error('Error auto-generating QR:', e);
      } finally {
        if (active) setGenerating(false);
      }
    }

    const timeoutId = setTimeout(() => {
      updateQRCode();
    }, 200);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [upiId, payeeName, amount, remarks]);

  const copyString = () => {
    const params: DecodedUpiContent = {
      pa: upiId,
      pn: payeeName,
      am: amount ? amount : undefined,
      tn: remarks ? remarks : undefined,
    };
    const uri = buildUpiUrl(params);
    navigator.clipboard.writeText(uri);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-center">
      
      {/* Visual Form Inputs */}
      <div className="flex-1 w-full space-y-4">
        <div>
          <h4 className="font-sans font-extrabold text-slate-900 text-lg flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-600" />
            Generate Personal QR Code
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Specify payments terms below to create a direct dynamic UPI QR ticket. Good for peer billing!
          </p>
        </div>

        <div className="space-y-3.5">
          {/* UPI Address field */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Beneficiary UPI Address
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g., wallet@amitcash"
              className="w-full text-xs font-mono bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-slate-800 transition-all outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Payee Name field */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Display Name (Payee)
              </label>
              <input
                type="text"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder="Beneficiary Name"
                className="w-full text-xs font-sans bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-slate-800 transition-all outline-none"
              />
            </div>

            {/* Requested Amount */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Request Amount (₹) <span className="text-xs text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g., 500"
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-slate-800 transition-all outline-none"
              />
            </div>
          </div>

          {/* Transaction Note */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Add Payment Remarks/Memo <span className="text-xs text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={remarks}
              maxLength={40}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g., Grocery loan payoff, Rent partition"
              className="w-full text-xs font-sans bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-slate-800 transition-all outline-none"
            />
          </div>
        </div>

        {/* Info label */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-start gap-2 text-[10px] text-slate-500 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            This generated canvas conforms strictly to AMITCASH specifications. Scanning this QR using your camera instantly starts a secure transfer.
          </span>
        </div>
      </div>

      {/* QR Code Presentation Box */}
      <div className="w-full md:w-60 bg-slate-50 border border-slate-100 rounded-3xl p-5 flex flex-col items-center justify-center text-center">
        <div className="relative w-44 h-44 bg-white border border-slate-100 rounded-2xl p-2 shadow-inner flex items-center justify-center overflow-hidden">
          {generating ? (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
            </div>
          ) : null}
          {qrCodeUrl ? (
            <img 
              src={qrCodeUrl} 
              alt="Generated Merchant Payment QR" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-xs text-slate-400">Loading QR...</span>
          )}
        </div>

        {/* UPI visual banners */}
        <div className="mt-3 flex items-center justify-center gap-1">
          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">AMITCASH SECURE PAY</span>
        </div>

        {/* Interactive Copy/Save Actions */}
        <div className="mt-4 flex gap-2 w-full">
          <button
            onClick={copyString}
            className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl py-2 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 focus:outline-none"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                Copied Link
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy UPI URL
              </>
            )}
          </button>
          
          {qrCodeUrl && (
            <a
              href={qrCodeUrl}
              download={`upi-ticket-${upiId}-${amount || 'fixed'}.png`}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl p-2.5 transition-colors flex items-center justify-center focus:outline-none"
              title="Download QR code image"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

    </div>
  );
}
