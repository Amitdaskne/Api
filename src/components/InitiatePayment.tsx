import React, { useState } from 'react';
import { Landmark, ArrowLeft, Shield, AlertCircle, Info, Lock } from 'lucide-react';
import { DecodedUpiContent, BankAccount } from '../types';

interface InitiatePaymentProps {
  paymentParams: DecodedUpiContent;
  bankAccounts: BankAccount[];
  activeBankId: string;
  onSelectBank: (id: string) => void;
  onProceedToPin: (amount: number, remarks: string, selectedBank: BankAccount) => void;
  onCancel: () => void;
}

export default function InitiatePayment({
  paymentParams,
  bankAccounts,
  activeBankId,
  onSelectBank,
  onProceedToPin,
  onCancel,
}: InitiatePaymentProps) {
  // Check if QR locked the amount
  const isAmountFixed = !!paymentParams.am && Number(paymentParams.am) > 0;
  
  const [amountInput, setAmountInput] = useState<string>(
    isAmountFixed ? parseFloat(paymentParams.am!).toString() : ''
  );
  const [remarksInput, setRemarksInput] = useState<string>(paymentParams.tn || '');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const selectedBank = bankAccounts.find(a => a.id === activeBankId) || bankAccounts[0];

  const handleProceed = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedAmt = parseFloat(amountInput);
    if (!amountInput || isNaN(parsedAmt) || parsedAmt <= 0) {
      setErrorMsg('Please specify a positive transfer amount.');
      return;
    }

    if (parsedAmt > 100000) {
      setErrorMsg('UPI daily transfer limit is ₹1,00,000 as per NPCI mandates.');
      return;
    }

    if (parsedAmt > selectedBank.balance) {
      setErrorMsg(`Insufficient funds. Your selected bank account has a balance of ₹${selectedBank.balance.toLocaleString('en-IN')}`);
      return;
    }

    onProceedToPin(parsedAmt, remarksInput.trim(), selectedBank);
  };

  const formattedBalance = selectedBank.balance.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
  });

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col my-auto">
        
        {/* Header toolbar */}
        <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-white">
          <button 
            onClick={onCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="font-sans font-bold text-slate-900 text-sm">Initiate UPI Payment</h3>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider font-mono">Secure Transfer Portal</p>
          </div>
        </div>

        {/* Recipient Details display card */}
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Beneficiary Name & ID</p>
            <h4 className="font-sans font-extrabold text-slate-800 text-sm mt-0.5 max-w-[240px] truncate">
              {paymentParams.pn || 'Verified Recipient'}
            </h4>
            <span className="text-[10px] text-slate-500 font-mono italic mt-0.5 block">{paymentParams.pa}</span>
          </div>

          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Verified UPI ID
          </span>
        </div>

        {/* Payment Formulation Form */}
        <form onSubmit={handleProceed} className="p-5 space-y-4 bg-white flex-1">
          
          {/* Amount Inputs */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Enter Amount to Transfer (INR)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-slate-400 font-bold text-lg">₹</span>
              <input
                type="number"
                min="1"
                max="100000"
                step="0.01"
                disabled={isAmountFixed}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                className={`w-full text-lg font-sans font-extrabold bg-slate-50 border rounded-2xl py-3 pl-8 pr-12 text-slate-900 focus:bg-white focus:border-indigo-500 transition-all outline-none ${
                  isAmountFixed 
                    ? 'border-emerald-200 bg-emerald-50/20 text-emerald-900' 
                    : 'border-slate-200'
                }`}
              />
              
              {isAmountFixed && (
                <div className="absolute right-3 flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[9px] px-2 py-1 rounded-lg font-bold uppercase border border-emerald-200">
                  <Lock className="w-3 h-3" /> Locked
                </div>
              )}
            </div>
            {isAmountFixed && (
              <p className="text-[10px] text-slate-400 mt-1 italic">
                This amount was pre-requisited by the scanned merchant QR code.
              </p>
            )}
          </div>

          {/* Remarks input */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Add Remarks / Transfer Memo <span className="text-xs text-slate-300 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              maxLength={40}
              placeholder="e.g., Grocery checkouts, Lunch splits"
              value={remarksInput}
              onChange={(e) => setRemarksInput(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2.5 px-3.5 text-slate-800 transition-all outline-none"
            />
          </div>

          {/* Bank Account Selector Card */}
          <div className="pt-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Select Debit Bank Account Source
            </label>
            <div className="space-y-2 max-h-[140px] overflow-y-auto">
              {bankAccounts.map((account, idx) => {
                const isSelected = account.id === activeBankId;
                return (
                  <div
                    key={`${account.id}-${idx}`}
                    onClick={() => onSelectBank(account.id)}
                    className={`p-3 rounded-2xl border cursor-pointer flex justify-between items-center transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-lg text-white font-bold flex items-center justify-center text-[10px]"
                        style={{ backgroundColor: account.logoColor }}
                      >
                        <Landmark className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-xs">{account.bankName}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{account.accountNumber} • Balance: ₹{account.balance.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                    }`}>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-600 px-3.5 py-2.5 rounded-xl border border-red-100 text-xs flex items-start gap-1.5 font-medium leading-relaxed">
              <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action flow */}
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-sans font-semibold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider"
            >
              <Shield className="w-4 h-4 text-sky-400" />
              Proceed to secure PIN Pad
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-sans font-bold py-2.5 px-4 rounded-xl border border-slate-200 transition-all text-xs"
            >
              Discard Payee
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
