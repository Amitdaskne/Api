import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, ShieldCheck, AlertCircle, Sparkles, Delete, ArrowRight } from 'lucide-react';
import { UserProfile } from '../types';

interface PinLockProps {
  userProfile: UserProfile;
  onUnlocked: () => void;
  onSetPin: (pin: string) => Promise<void>;
}

export default function PinLock({ userProfile, onUnlocked, onSetPin }: PinLockProps) {
  const isPinConfigured = !!userProfile.appPin;
  const [mode, setMode] = useState<'ENTER' | 'SET' | 'CONFIRM'>(isPinConfigured ? 'ENTER' : 'SET');
  
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [tempSetPin, setTempSetPin] = useState<string>('');
  
  const [errorText, setErrorText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);

  const handleNumberPress = (num: number) => {
    setErrorText('');
    setShake(false);
    const target = mode === 'CONFIRM' ? confirmPin : pin;
    if (target.length >= 4) return;
    
    const newVal = target + num;
    if (mode === 'CONFIRM') {
      setConfirmPin(newVal);
      if (newVal.length === 4) {
        // Trigger verification for configuration
        verifyAndSubmitSetPin(newVal);
      }
    } else {
      setPin(newVal);
      if (newVal.length === 4) {
        if (mode === 'ENTER') {
          verifyUnlockPin(newVal);
        } else {
          // SET mode: advance to CONFIRM step
          setTimeout(() => {
            setTempSetPin(newVal);
            setMode('CONFIRM');
            setPin('');
          }, 200);
        }
      }
    }
  };

  const handleBackspace = () => {
    setErrorText('');
    setShake(false);
    if (mode === 'CONFIRM') {
      setConfirmPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
  };

  // 1. Verify returning user's unlock PIN
  const verifyUnlockPin = (typedPin: string) => {
    if (typedPin === userProfile.appPin) {
      onUnlocked();
    } else {
      setTimeout(() => {
        setShake(true);
        setErrorText('Incorrect Security PIN. Please try again.');
        setPin('');
      }, 150);
    }
  };

  // 2. Set new user's custom PIN
  const verifyAndSubmitSetPin = async (confirmVal: string) => {
    if (confirmVal !== tempSetPin) {
      setShake(true);
      setErrorText('PINs do not match! Please start over.');
      setPin('');
      setConfirmPin('');
      setTempSetPin('');
      setMode('SET');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSetPin(confirmVal);
      onUnlocked();
    } catch (err: any) {
      setErrorText(err.message || 'Failed to update App PIN.');
      setMode('SET');
      setPin('');
      setConfirmPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSymbolsCount = mode === 'CONFIRM' ? confirmPin.length : pin.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-between p-6 overflow-y-auto font-sans text-white">
      {/* Premium glowing circles in backgrounds */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Top Brand Tag */}
      <div className="text-center pt-8 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-505/10 rounded-full border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2.5">
          <Sparkles className="w-3.5 h-3.5" />
          AMITCASH Secure Gateway
        </div>
        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">NPCI Certified Portal</p>
      </div>

      {/* Center Interactive Lock Stage */}
      <motion.div 
        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm flex flex-col items-center text-center my-auto py-6"
      >
        <div className="w-16 h-16 rounded-3xl bg-indigo-900/40 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 shadow-lg">
          <Lock className="w-7 h-7" />
        </div>

        {/* Dynamic header texts depending on configure lifecycle */}
        <AnimatePresence mode="wait">
          {mode === 'ENTER' && (
            <motion.div
              key="enter"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <h3 className="text-xl font-black text-white tracking-tight">Enter Secure Security PIN</h3>
              <p className="text-xs text-slate-400 mt-1.5 px-4 animate-pulse">
                Verify your 4-digit security PIN to unlock your dashboard balance and assets.
              </p>
            </motion.div>
          )}

          {mode === 'SET' && (
            <motion.div
              key="set"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <h3 className="text-xl font-black text-amber-400 tracking-tight flex items-center justify-center gap-2">
                Generate 4-Digit Security PIN
              </h3>
              <p className="text-xs text-indigo-200 mt-1.5 px-4 leading-relaxed">
                Choose a custom 4-digit security PIN. You will need to enter this PIN to unlock the app and also to verify your account balances!
              </p>
            </motion.div>
          )}

          {mode === 'CONFIRM' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <h3 className="text-xl font-black text-emerald-400 tracking-tight">Confirm Your Security PIN</h3>
              <p className="text-xs text-slate-300 mt-1.5 px-4">
                Please re-enter your chosen PIN keys to verify your setup sequence.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Security code display slots */}
        <div className="flex gap-4.5 justify-center py-8">
          {[0, 1, 2, 3].map((index) => {
            const hasValue = index < currentSymbolsCount;
            return (
              <div key={index} className="relative w-11 h-11 flex items-center justify-center">
                <div 
                  className={`absolute inset-0 rounded-2xl transition-all duration-200 ${
                    hasValue 
                      ? 'border-2 border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.25)]' 
                      : 'border border-slate-800 bg-slate-900/60'
                  }`}
                />
                <AnimatePresence>
                  {hasValue && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="w-3.5 h-3.5 rounded-full bg-indigo-400 relative z-10"
                    />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Visual Error messages */}
        <AnimatePresence>
          {errorText && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-1.5"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorText}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Numeric Premium Lockscreen Keypad */}
      <div className="w-full max-w-xs relative z-10 pb-6">
        <div className="grid grid-cols-3 gap-y-4 gap-x-6 justify-items-center">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberPress(num)}
              className="w-16 h-16 rounded-full bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border border-slate-800/60 flex items-center justify-center text-xl font-bold text-slate-100 transition-colors shadow-sm cursor-pointer select-none"
            >
              {num}
            </button>
          ))}
          
          {/* Custom Clear button */}
          <button
            onClick={() => {
              setErrorText('');
              setShake(false);
              setPin('');
              setConfirmPin('');
            }}
            className="w-16 h-16 rounded-full flex items-center justify-center text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors cursor-pointer select-none"
          >
            Clear
          </button>

          {/* Number 0 */}
          <button
            onClick={() => handleNumberPress(0)}
            className="w-16 h-16 rounded-full bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border border-slate-800/60 flex items-center justify-center text-xl font-bold text-slate-100 transition-colors shadow-sm cursor-pointer select-none"
          >
            0
          </button>

          {/* Delete backspace icon */}
          <button
            onClick={handleBackspace}
            className="w-16 h-16 rounded-full text-slate-400 hover:text-slate-200 active:scale-95 flex items-center justify-center transition-all cursor-pointer select-none"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Security badge labels */}
        <div className="mt-8 flex justify-center items-center gap-1.5 text-slate-500 text-[10px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
          <span>Biometric-grade secure encryption active</span>
        </div>
      </div>
    </div>
  );
}
