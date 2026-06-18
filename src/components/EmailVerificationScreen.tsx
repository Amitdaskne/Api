import React, { useState, useEffect } from 'react';
import { sendEmailVerification, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';
import { 
  Mail, ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, LogOut, Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EmailVerificationScreenProps {
  user: FirebaseUser;
  onVerified: () => void;
  onSignOut: () => void;
}

export default function EmailVerificationScreen({ user, onVerified, onSignOut }: EmailVerificationScreenProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string>('');
  const [successText, setSuccessText] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);

  // Poll or check status immediately
  const checkStatus = async () => {
    setErrorText('');
    setSuccessText('');
    setLoading(true);

    try {
      // Reload user data to pull freshest emailVerified flag from Firebase Authentication console
      await user.reload();
      const refreshedUser = auth.currentUser;

      if (refreshedUser && refreshedUser.emailVerified) {
        setSuccessText('Email verified successfully! Opening your secure wallet...');
        setTimeout(() => {
          onVerified();
        }, 1500);
      } else {
        setErrorText('Verification link not activated yet. Please click the link sent to your inbox/spam folder.');
      }
    } catch (err: any) {
      console.error('Error checking verification:', err);
      setErrorText(err.message || 'Unable to refresh verification status.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger link re-transmission
  const handleResend = async () => {
    if (countdown > 0) return;
    setErrorText('');
    setSuccessText('');
    setLoading(true);

    try {
      await sendEmailVerification(user);
      setSuccessText('A new verification email has been dispatched. Please check your inbox!');
      setCountdown(30);
      setTimeout(() => setSuccessText(''), 4000);
    } catch (err: any) {
      console.error('Error resending:', err);
      setErrorText(err.message || 'Too many requests. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Check periodically every 5 seconds to automatically log them in once they click link in tab
  useEffect(() => {
    let active = true;
    const checkInterval = setInterval(async () => {
      try {
        await user.reload();
        const refreshedUser = auth.currentUser;
        if (active && refreshedUser && refreshedUser.emailVerified) {
          clearInterval(checkInterval);
          setSuccessText('Email verified automatically! Opening your secure wallet...');
          setTimeout(() => {
            if (active) onVerified();
          }, 1500);
        }
      } catch (err) {
        // Fail silently during periodic polling
      }
    }, 5000);

    return () => {
      active = false;
      clearInterval(checkInterval);
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Premium backdrop glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl relative z-10 p-6 sm:p-8"
      >
        {/* Step Indicator */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            Step 2: Email Verification Check
          </div>
          <h2 className="font-sans font-extrabold text-2xl text-white tracking-tight">
            Security Clearance
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Now verify your registered mail account to protect your savings.
          </p>
        </div>

        {/* Global alert messages */}
        <AnimatePresence mode="wait">
          {errorText && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-2xl flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorText}</span>
            </motion.div>
          )}

          {successText && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successText}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card Body */}
        <div className="text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner relative">
            <Mail className="w-7 h-7 animate-bounce" />
            <div className="absolute top-0 right-0 w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
          </div>

          <div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              We have dispatched a specialized security verification check to:
              <br />
              <span className="text-indigo-300 font-bold text-sm block mt-1 select-all">{user.email}</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-2">
              Please click the activation URL in the email to authenticate. (Check spam folders)
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={checkStatus}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-sans font-bold text-xs py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-sky-300" />
                  VERIFY EMAIL STATUS NOW
                </>
              )}
            </button>

            <button
              onClick={handleResend}
              disabled={loading || countdown > 0}
              className="w-full bg-slate-800/60 hover:bg-slate-800 disabled:text-slate-500 text-slate-305 border border-slate-700/60 font-sans font-semibold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer"
            >
              {countdown > 0 ? `Resend Available in ${countdown}s` : 'Resend Verification Mail'}
            </button>

            <button
              onClick={onSignOut}
              className="text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 mx-auto pt-3 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              Return and Log Out
            </button>
          </div>

          {/* Development Tips */}
          <div className="text-[10px] text-slate-500 leading-normal text-left bg-slate-950/40 border border-slate-800/80 p-3 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 text-indigo-400 float-left mr-1.5 mt-0.5" />
            <span>
              If you aren't receiving the email, check your junk folder or click <strong>Resend</strong>. Keep this page open while you verify: it autodetects completion in real-time.
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
