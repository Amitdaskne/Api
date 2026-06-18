import React, { useState, useEffect } from 'react';
import { 
  Barcode, Copy, Check, ShieldCheck, Sparkles, RefreshCw, 
  Ticket, Gift, CreditCard, Flame, KeyRound, CheckCircle2, AlertCircle, Trash2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, SecureVoucher } from '../types';
import { doc, updateDoc, collection, addDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { generateRefNo } from '../utils/upi';

interface GenerateCodesProps {
  userProfile: UserProfile;
}

export default function GenerateCodes({ userProfile }: GenerateCodesProps) {
  // Paycode OTP States
  const [paycode, setPaycode] = useState<string>('');
  const [pincodeProgress, setPincodeProgress] = useState<number>(100);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [copiedPaycode, setCopiedPaycode] = useState<boolean>(false);

  // Voucher Creation States
  const [voucherAmount, setVoucherAmount] = useState<number>(100);
  const [voucherType, setVoucherType] = useState<'DEBIT' | 'MOCK'>('MOCK');
  const [generatingVoucher, setGeneratingVoucher] = useState<boolean>(false);
  const [newlyCreatedVoucher, setNewlyCreatedVoucher] = useState<SecureVoucher | null>(null);
  const [createError, setCreateError] = useState<string>('');
  const [createSuccess, setCreateSuccess] = useState<string>('');

  // Voucher Redemption States
  const [redeemInput, setRedeemInput] = useState<string>('');
  const [redeeming, setRedeeming] = useState<boolean>(false);
  const [redeemError, setRedeemError] = useState<string>('');
  const [redeemSuccess, setRedeemSuccess] = useState<string>('');

  // Scrambled barcode stripes for visual playfulness (rendered securely using CSS divs)
  const [barcodePattern, setBarcodePattern] = useState<number[]>([]);

  // 1. Generate OTP Paycode and random barcode stripes
  const triggerNewOtp = () => {
    const random6Details = Math.floor(100000 + Math.random() * 900000).toString();
    // Format as 3-3 e.g., "472 819"
    setPaycode(`${random6Details.substring(0, 3)} ${random6Details.substring(3, 6)}`);
    setSecondsRemaining(30);
    setPincodeProgress(100);

    // Random stripe width percentages for barcode
    const stripes = Array.from({ length: 28 }, () => Math.floor(Math.random() * 4) + 1);
    setBarcodePattern(stripes);
  };

  useEffect(() => {
    triggerNewOtp();
  }, []);

  // Update Countdown Timer for OTP Paycode
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          triggerNewOtp();
          return 30;
        }
        const next = prev - 1;
        setPincodeProgress((next / 30) * 100);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Copy OTP Paycode
  const handleCopyPaycode = () => {
    navigator.clipboard.writeText(paycode.replace(/\s/g, ''));
    setCopiedPaycode(true);
    setTimeout(() => setCopiedPaycode(false), 2000);
  };

  // 2. Generate a Cash Voucher
  const handleGenerateVoucher = async () => {
    setCreateError('');
    setCreateSuccess('');
    setNewlyCreatedVoucher(null);

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setCreateError('User session expired. Please sign in again.');
      return;
    }

    if (voucherAmount <= 0 || isNaN(voucherAmount)) {
      setCreateError('Please enter a valid amount.');
      return;
    }

    setGeneratingVoucher(true);

    try {
      const amitBank = userProfile.bankAccounts.find(b => b.id === 'amit-bank');
      if (!amitBank) {
        throw new Error('Verified bank account not found.');
      }

      if (voucherType === 'DEBIT' && amitBank.balance < voucherAmount) {
        throw new Error(`Insufficient funds in AMIT PAYMENTS BANK account. Your balance is ₹${amitBank.balance.toFixed(2)}.`);
      }

      // Generate random alphanumeric claim code
      const hex = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let pinSet = '';
      for (let i = 0; i < 8; i++) {
        pinSet += hex.charAt(Math.floor(Math.random() * hex.length));
      }
      const uniqueCode = `AMITCASH-${voucherAmount}-${pinSet}`;

      const newVoucher: SecureVoucher = {
        code: uniqueCode,
        amount: voucherAmount,
        createdAt: new Date().toISOString(),
        isRedeemed: false,
        creatorUpi: userProfile.upiId
      };

      const userRef = doc(db, 'users', currentUser.uid);

      // Fetch fresh document to ensure arrays are valid
      const snap = await getDoc(userRef);
      const currentData = snap.data();
      const existingCodes = currentData?.generatedCodes || [];

      const updatedCodes = [...existingCodes, newVoucher];
      
      if (voucherType === 'DEBIT') {
        // Debit money from bank balance
        const updatedAccounts = userProfile.bankAccounts.map(b => {
          if (b.id === 'amit-bank') {
            return {
              ...b,
              balance: Math.max(0, b.balance - voucherAmount)
            };
          }
          return b;
        });
        const nextProfileBalance = Math.max(0, (userProfile.balance || 50.00) - voucherAmount);

        await updateDoc(userRef, {
          bankAccounts: updatedAccounts,
          balance: nextProfileBalance,
          generatedCodes: updatedCodes
        });

        // Record immediate Debit Transaction in the ledger logs!
        const refNo = generateRefNo();
        await addDoc(collection(db, 'transactions'), {
          type: 'SEND',
          name: 'Voucher Fund Locked',
          upiId: 'voucher@amitcash',
          amount: voucherAmount,
          status: 'SUCCESS',
          date: new Date().toISOString(),
          refNo,
          remarks: `Prepaid Cash Voucher code generated: ${uniqueCode.substring(0, 14)}•••`,
          bankName: 'AMIT PAYMENTS BANK',
          userId: currentUser.uid
        });
      } else {
        // Mock Voucher - no debit occurs, created out of thin air for simulation play
        await updateDoc(userRef, {
          generatedCodes: updatedCodes
        });
      }

      setNewlyCreatedVoucher(newVoucher);
      setCreateSuccess(`Voucher ${uniqueCode} generated successfully!`);
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || 'An error occurred during secure verification.');
    } finally {
      setGeneratingVoucher(false);
    }
  };

  // 3. Redeem/Claim a Cash Voucher
  const handleRedeemVoucher = async () => {
    setRedeemError('');
    setRedeemSuccess('');
    const targetCode = redeemInput.trim();

    if (!targetCode) {
      setRedeemError('Please type or paste a voucher code first.');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setRedeemError('User session expired.');
      return;
    }

    setRedeeming(true);

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        throw new Error('User profile record not found.');
      }

      const data = snap.data();
      const existingCodes: SecureVoucher[] = data.generatedCodes || [];

      // Find the code inside user's voucher stack
      const voucherIndex = existingCodes.findIndex(v => v.code === targetCode);
      if (voucherIndex === -1) {
        throw new Error('Invalid or unrecognized security voucher code. Please verify digits.');
      }

      const targetVoucher = existingCodes[voucherIndex];
      if (targetVoucher.isRedeemed) {
        throw new Error(`This voucher code was already redeemed on ${new Date(targetVoucher.redeemedAt || '').toLocaleString('en-IN')}.`);
      }

      // Mark as redeemed in database
      const updatedCodes = [...existingCodes];
      updatedCodes[voucherIndex] = {
        ...targetVoucher,
        isRedeemed: true,
        redeemedAt: new Date().toISOString()
      };

      // Credit the verified bank funds
      const creditAmt = targetVoucher.amount;
      const updatedAccounts = (data.bankAccounts || []).map((b: any) => {
        if (b.id === 'amit-bank') {
          return {
            ...b,
            balance: b.balance + creditAmt
          };
        }
        return b;
      });
      const nextProfileBalance = (data.balance !== undefined ? data.balance : 50.00) + creditAmt;

      // Safe update
      await updateDoc(userRef, {
        bankAccounts: updatedAccounts,
        balance: nextProfileBalance,
        generatedCodes: updatedCodes
      });

      // Record immediate RECEIVE transaction trace
      const refNo = generateRefNo();
      await addDoc(collection(db, 'transactions'), {
        type: 'RECEIVE',
        name: 'Voucher Cash Credit',
        upiId: 'voucher@amitcash',
        amount: creditAmt,
        status: 'SUCCESS',
        date: new Date().toISOString(),
        refNo,
        remarks: `Voucher Code Redeemed (${targetCode.substring(targetCode.length - 8)})`,
        bankName: 'AMIT PAYMENTS BANK',
        userId: currentUser.uid
      });

      setRedeemSuccess(`Hurrah! ₹${creditAmt.toLocaleString('en-IN')} has been immediately added to your AMIT PAYMENTS BANK account.`);
      setRedeemInput('');
    } catch (err: any) {
      console.error(err);
      setRedeemError(err.message || 'Verification fail.');
    } finally {
      setRedeeming(false);
    }
  };

  // Helper clear / delete a redeemed voucher from view to tidy up lists
  const handleDeleteVoucherIndex = async (indexToDelete: number) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const currentList = userProfile.generatedCodes || [];
      const updatedList = currentList.filter((_, idx) => idx !== indexToDelete);
      await updateDoc(userRef, {
        generatedCodes: updatedList
      });
    } catch (err) {
      console.error('Error tidying voucher:', err);
    }
  };

  const activeVouchersList = userProfile.generatedCodes || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Module A: One-Time Paycode Authenticator */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-650 bg-indigo-50 border border-indigo-150 px-2.5 py-1 rounded-full">
                  Secure Token Pay
                </span>
                <h4 className="font-sans font-black text-slate-900 text-lg mt-2.5">
                  Dynamic OTP Paycode
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Present this code at secure AMITCASH desks. It authenticates and settles funds from your single bank account instantly.
                </p>
              </div>
              <KeyRound className="w-8 h-8 text-indigo-500 bg-indigo-50 p-2 rounded-xl" />
            </div>

            {/* Dynamic visual representation */}
            <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100/60 flex flex-col items-center justify-center relative shadow-inner text-center">
              
              {/* Dynamic Progress circular-style row indicator */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/80 border border-slate-100/80 px-2 py-0.5 rounded-full shadow-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                <span className="text-[9px] font-mono font-bold text-slate-650">{secondsRemaining}s</span>
              </div>

              {/* Secure barcode simulator purely in HTML details */}
              <div className="flex gap-0.5 items-end justify-center w-full max-w-xs h-14 bg-white border border-slate-100 rounded-lg p-2.5 overflow-hidden">
                {barcodePattern.map((width, idx) => (
                  <div 
                    key={idx}
                    style={{ width: `${width * 3}px` }} 
                    className={`h-full bg-slate-900 rounded-xs shrink-0 ${idx % 3 === 0 ? 'opacity-30' : ''}`}
                  />
                ))}
              </div>

              {/* Dynamic Number Value */}
              <span className="font-mono text-3xl font-black text-slate-950 tracking-widest block mt-4 select-all">
                {paycode}
              </span>

              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                VERIFIED SOURCE: AMIT PAYMENTS BANK
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button
              onClick={handleCopyPaycode}
              className="flex-1 bg-white hover:bg-slate-50 border border-slate-205 text-slate-700 hover:text-slate-900 text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer outline-none"
            >
              {copiedPaycode ? (
                <>
                  <Check className="w-4 h-4 text-emerald-650" />
                  Code Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  Copy Paycode
                </>
              )}
            </button>
            <button
              onClick={triggerNewOtp}
              className="px-3 bg-slate-900 hover:bg-slate-800 text-teal-400 text-xs font-bold rounded-xl transition-colors flex items-center justify-center cursor-pointer outline-none"
              title="Force Refresh Pin"
            >
              <RefreshCw className="w-4 h-4 animate-spin" />
            </button>
          </div>

          {/* Glowing bottom line indicator */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 transition-all duration-1000" style={{ width: `${pincodeProgress}%` }} />
        </div>

        {/* Module B: Cash Voucher Claims Station */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-150 px-2.5 py-1 rounded-full">
                  Instant Redeem
                </span>
                <h4 className="font-sans font-black text-slate-900 text-lg mt-2.5">
                  Voucher Claim Station
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Redeem secure AMITCASH codes here. Claiming successfully adds the voucher amount instantly to your verified bank balance.
                </p>
              </div>
              <Gift className="w-8 h-8 text-emerald-600 bg-emerald-50 p-2 rounded-xl" />
            </div>

            {/* Error & Success Messages */}
            <AnimatePresence mode="wait">
              {redeemError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-start gap-1.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{redeemError}</span>
                </motion.div>
              )}

              {redeemSuccess && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3.5 bg-emerald-550/10 border border-emerald-500/20 text-emerald-600 rounded-xl text-xs flex items-start gap-2 animate-fade-in"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-medium">{redeemSuccess}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                Unlock Voucher key Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., AMITCASH-100-XYZ8..."
                  value={redeemInput}
                  onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2.5 px-3.5 font-mono text-xs outline-none uppercase transition-all tracking-wider text-slate-800"
                />
                <button
                  type="button"
                  onClick={handleRedeemVoucher}
                  disabled={redeeming}
                  className="bg-slate-900 border border-slate-900 hover:bg-slate-850 disabled:bg-slate-800 text-teal-400 px-4 py-2.5 font-sans font-black text-xs rounded-xl shadow-sm transition-colors cursor-pointer shrink-0 outline-none uppercase"
                >
                  {redeeming ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Claim'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-amber-100/50 border border-amber-200/60 rounded-xl p-3 text-[10px] text-amber-800 flex items-start gap-1.5 leading-normal">
            <Flame className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Tester Tip:</strong> You can create test vouchers below for free under "Mock Cash" mode to load ₹50, ₹100, or custom balances anytime!
            </span>
          </div>
        </div>

      </div>

      {/* Module C: Create Vouchers */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">
        <div>
          <h4 className="font-sans font-extrabold text-slate-900 text-base">
            Create Custom Vouchers
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Generate printable cash codes. Choose <strong>Debit</strong> mode to pre-pay using your AMIT PAYMENTS BANK balance, or <strong>Free Mock Code</strong> for developer sandbox simulations.
          </p>
        </div>

        {/* Form controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          
          {/* Amount Selector */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Voucher Cash Amount (₹)
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {[50, 100, 200, 500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setVoucherAmount(amt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    voucherAmount === amt 
                      ? 'bg-indigo-600 text-white border-indigo-650 shadow-sm' 
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-205 text-slate-700'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              value={voucherAmount}
              onChange={(e) => setVoucherAmount(Math.max(1, parseInt(e.target.value) || 0))}
              placeholder="Custom amount"
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2 px-3 text-xs outline-none transition-all font-semibold"
            />
          </div>

          {/* Funding source type selection */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Verification Funding Mode
            </label>
            <div className="grid grid-cols-2 gap-1 bg-slate-50 p-1 border border-slate-200/80 rounded-xl">
              <button
                type="button"
                onClick={() => setVoucherType('MOCK')}
                className={`py-2 px-3 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  voucherType === 'MOCK'
                    ? 'bg-white shadow-xs text-slate-800 border border-slate-150'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mock Free
              </button>
              <button
                type="button"
                onClick={() => setVoucherType('DEBIT')}
                className={`py-2 px-3 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  voucherType === 'DEBIT'
                    ? 'bg-white shadow-xs text-indigo-600 border border-indigo-150'
                    : 'text-slate-500 hover:text-indigo-600'
                }`}
              >
                Debit Bank
              </button>
            </div>
          </div>

          {/* Action Trigger */}
          <button
            onClick={handleGenerateVoucher}
            disabled={generatingVoucher}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-805 text-white py-3.5 px-4 font-sans font-extrabold text-xs rounded-xl shadow-md uppercase tracking-wider flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer outline-none"
          >
            {generatingVoucher ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Ticket className="w-4 h-4 animate-pulse" />
                Generate Secure Voucher
              </>
            )}
          </button>

        </div>

        {/* Create Error */}
        {createError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{createError}</span>
          </div>
        )}

        {/* NEWLY GENERATED VOUCHER TICKET BOX */}
        {newlyCreatedVoucher && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border-2 border-dashed border-indigo-400 bg-indigo-50/30 rounded-3xl p-5 relative overflow-hidden"
          >
            {/* Background design elements */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-indigo-650 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Ticket className="w-5 h-5 text-sky-305" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">YOUR SECURE SERIAL TICKET</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-slate-800 font-extrabold text-sm select-all">
                      {newlyCreatedVoucher.code}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(newlyCreatedVoucher.code);
                        alert('Voucher claim code copied to clipboard!');
                      }}
                      className="text-indigo-600 hover:text-indigo-800 transition-colors"
                      title="Copy claim code"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-indigo-150">
                <span className="text-xs text-slate-500">Voucher Value</span>
                <span className="font-sans font-black text-2xl text-slate-900 tracking-tight">
                  ₹{newlyCreatedVoucher.amount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-dashed border-indigo-200/80 flex flex-col sm:flex-row justify-between text-[10px] text-slate-500 gap-1.5">
              <span>CREATED: {new Date(newlyCreatedVoucher.createdAt).toLocaleString('en-IN')}</span>
              <span className="font-bold text-indigo-600">
                {voucherType === 'DEBIT' ? '🔴 LOCKED FROM SAVINGS BANK' : '🟢 TESTER SANDBOX CODE'}
              </span>
            </div>

            {/* Scissors cut layout visual line */}
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between px-1 pointer-events-none">
              <div className="w-3 h-6 rounded-r-full bg-white border border-slate-100 -ml-1 border-l-0" />
              <div className="w-3 h-6 rounded-l-full bg-white border border-slate-100 -mr-1 border-r-0" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Module D: Vouchers Inventory Log */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h4 className="font-sans font-extrabold text-slate-900 text-base">
              Vouchers Inventory & History
            </h4>
            <p className="text-xs text-slate-505 mt-0.5">
              Track custom keys created by your profile. You can tidy up by removing redeemed items.
            </p>
          </div>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Total count: {activeVouchersList.length}
          </span>
        </div>

        {activeVouchersList.length === 0 ? (
          <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-201/60 text-slate-400">
            <Ticket className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-slate-500">No vouchers generated yet</p>
            <p className="text-[10px] mt-0.5 text-slate-400">Use the generator module above to manufacture custom serial vouchers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-500">
              <thead className="text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50/80">
                <tr>
                  <th scope="col" className="px-4 py-3 rounded-l-xl">Claim Code</th>
                  <th scope="col" className="px-4 py-3">Cash Value</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 rounded-r-xl text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeVouchersList.map((voc, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="select-all block truncate max-w-[170px]">{voc.code}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(voc.code);
                          alert('Copied code!');
                        }}
                        className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-sans font-black text-slate-900">
                      ₹{voc.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      {voc.code.startsWith('AMITCASH-100-') || voc.code.includes('MOCK') || !voc.creatorUpi ? (
                        <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Sandbox
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          Prepaid Debit
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {voc.isRedeemed ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Redeemed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 animate-pulse">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          if (voc.isRedeemed || confirm('Are you sure you want to dismiss this voucher? If it is a Debit voucher, dismissals will permanently retire the card logs.')) {
                            handleDeleteVoucherIndex(idx);
                          }
                        }}
                        className="p-1 px-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 transition-all cursor-pointer"
                        title="Delete voucher from view"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
