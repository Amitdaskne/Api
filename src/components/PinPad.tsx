import { useState, useEffect } from 'react';
import { Shield, Delete, X, AlertCircle } from 'lucide-react';
import { BankAccount } from '../types';

interface PinPadProps {
  bankAccount: BankAccount;
  paymentAmount: number;
  payeeName: string;
  payeeUpi: string;
  onPinSuccess: () => void;
  onPinFailure: (attemptsLeft: number) => void;
  onCancel: () => void;
}

export default function PinPad({
  bankAccount,
  paymentAmount,
  payeeName,
  payeeUpi,
  onPinSuccess,
  onPinFailure,
  onCancel,
}: PinPadProps) {
  // Read target PIN length from the configured account (default to 4 or 6)
  const targetPinLength = bankAccount.upiPin.length;
  const [pin, setPin] = useState<string>('');
  const [shuffleKeys, setShuffleKeys] = useState<boolean>(true);
  const [keypad, setKeypad] = useState<string[]>(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
  const [attempts, setAttempts] = useState<number>(3);
  const [errorText, setErrorText] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Generate keypad layout
  useEffect(() => {
    const defaultKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    if (shuffleKeys) {
      // Fisher-Yates array shuffling
      const scrambled = [...defaultKeys];
      for (let i = scrambled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]];
      }
      setKeypad(scrambled);
    } else {
      setKeypad(defaultKeys);
    }
  }, [shuffleKeys, attempts]);

  const handleKeyPress = (num: string) => {
    setErrorText('');
    if (pin.length < targetPinLength) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setErrorText('');
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorText('');
    setPin('');
  };

  const handleSubmit = () => {
    if (pin.length !== targetPinLength) {
      setErrorText(`Please enter a full ${targetPinLength}-digit UPI PIN.`);
      triggerShake();
      return;
    }

    if (pin === bankAccount.upiPin) {
      onPinSuccess();
    } else {
      const nextAttempts = attempts - 1;
      setAttempts(nextAttempts);
      setPin('');
      triggerShake();
      
      if (nextAttempts <= 0) {
        onPinFailure(0);
      } else {
        setErrorText(`Incorrect UPI PIN. ${nextAttempts} attempts remaining.`);
        onPinFailure(nextAttempts);
      }
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
        
        {/* UPI Secure Banner */}
        <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-400" />
            <span className="font-mono text-xs font-semibold tracking-wider text-teal-400">AMITCASH • SECURE PIN ENTRY</span>
          </div>
          <button 
            onClick={onCancel}
            className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Payment Summary */}
        <div className="bg-slate-50 p-5 border-b border-slate-100 text-center">
          <p className="text-xs text-slate-500 font-medium tracking-tight uppercase">Paying</p>
          <h4 className="font-sans font-bold text-slate-800 text-base mt-0.5 line-clamp-1">{payeeName}</h4>
          <span className="text-[10px] text-slate-400 font-mono italic block mb-2">{payeeUpi}</span>
          
          <div className="text-2xl font-bold font-sans text-slate-900 inline-flex items-baseline">
            <span className="text-sm font-semibold text-slate-500 mr-0.5">₹</span>
            {paymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>

          <div className="mt-3.5 pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-left text-xs text-slate-600">
            <div>
              <p className="font-semibold text-slate-800">{bankAccount.bankName}</p>
              <p className="text-[10px] text-slate-400">{bankAccount.accountNumber} • {bankAccount.bankType}</p>
            </div>
            <div className="w-3.5 h-3.5 rounded-full bg-indigo-600 inline-block" style={{ backgroundColor: bankAccount.logoColor }} />
          </div>
        </div>

        {/* Pin Display Area */}
        <div className="py-6 flex flex-col items-center justify-center bg-white">
          <p className="text-xs font-semibold text-slate-700 mb-3">
            Enter {targetPinLength}-Digit UPI PIN
          </p>
          
          {/* Masked circles dots */}
          <div className={`flex gap-3 justify-center mb-2.5 ${isShaking ? 'animate-shake' : ''}`}>
            {Array.from({ length: targetPinLength }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                  i < pin.length
                    ? 'bg-slate-800 border-slate-800 scale-110'
                    : 'bg-transparent border-slate-300'
                }`}
              />
            ))}
          </div>

          {errorText && (
            <div className="px-5 text-center flex items-center justify-center gap-1 text-red-500 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] font-medium leading-relaxed">{errorText}</span>
            </div>
          )}
        </div>

        {/* Shuffling Setting Option */}
        <div className="px-5 pb-2 pt-0.5 flex justify-between items-center text-slate-500 bg-white border-t border-slate-100">
          <span className="text-[10px] font-medium">Scramble keypad for extra security</span>
          <button
            onClick={() => setShuffleKeys(!shuffleKeys)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
              shuffleKeys 
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            {shuffleKeys ? 'SHUFFLE: ON' : 'SHUFFLE: OFF'}
          </button>
        </div>

        {/* Numeric Keypad Grid */}
        <div className="grid grid-cols-3 gap-0 bg-slate-50 p-2 border-t border-slate-100">
          {/* Layout buttons */}
          {keypad.slice(0, 9).map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="py-3.5 text-center font-sans font-bold text-lg text-slate-800 hover:bg-slate-200/50 active:bg-slate-200 rounded-xl transition-colors focus:outline-none"
            >
              {num}
            </button>
          ))}
          
          {/* Bottom row: Reset, 0, Delete */}
          <button
            onClick={handleClear}
            className="py-3.5 text-center font-mono text-[10px] font-bold text-slate-500 hover:bg-slate-200/50 active:bg-slate-200 rounded-xl transition-colors uppercase focus:outline-none"
          >
            Clear
          </button>
          
          <button
            onClick={() => handleKeyPress(keypad[9])}
            className="py-3.5 text-center font-sans font-bold text-lg text-slate-800 hover:bg-slate-200/50 active:bg-slate-200 rounded-xl transition-colors focus:outline-none"
          >
            {keypad[9]}
          </button>

          <button
            onClick={handleDelete}
            className="py-3.5 flex items-center justify-center text-slate-500 hover:bg-slate-200/50 active:bg-slate-200 rounded-xl transition-colors focus:outline-none"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Submit NPCI Action Button */}
        <div className="p-3 bg-slate-50 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-sans font-semibold py-3 px-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 text-xs"
          >
            <Shield className="w-4 h-4 text-sky-400" />
            SECURELY PAY ₹{paymentAmount}
          </button>
        </div>

      </div>
    </div>
  );
}
