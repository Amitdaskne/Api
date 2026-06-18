import React, { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { uploadToCloudinary } from '../utils/cloudinary';
import { 
  Mail, Lock, User, Phone, ShieldCheck, Sparkles, 
  Upload, RefreshCw, AlertCircle, CheckCircle2, ChevronRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthProps {
  onUserAuthenticated: (user: FirebaseUser) => void;
}

export default function Auth({ onUserAuthenticated }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');
  const [customUpiPin, setCustomUpiPin] = useState<string>('1234');
  
  // Custom Cloudinary upload status
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);

  // Status logs
  const [errorText, setErrorText] = useState<string>('');
  const [successText, setSuccessText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Email verification pending state
  const [pendingVerificationUser, setPendingVerificationUser] = useState<FirebaseUser | null>(null);

  // Auto-generate a beautiful custom UPI ID when the user enters their name
  useEffect(() => {
    if (isSignUp && name) {
      const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (sanitized) {
        setUpiId(`${sanitized}@amitcash`);
      }
    }
  }, [name, isSignUp]);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      setErrorText('');
      const uploadedUrl = await uploadToCloudinary(file);
      setAvatarUrl(uploadedUrl);
      setSuccessText('Profile avatar uploaded to Cloudinary successfully!');
      setTimeout(() => setSuccessText(''), 3000);
    } catch (err: any) {
      setErrorText(err.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Sign Up Flow
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');

    if (!name.trim() || !phone.trim() || !upiId.trim()) {
      setErrorText('Please provide all registry details.');
      return;
    }

    // Phone standard validation
    if (!/^\+?[0-9\s-]{10,20}$/.test(phone)) {
      setErrorText('Please enter a valid phone number (at least 10 digits).');
      return;
    }

    // UPI PIN validation
    if (!/^\d{4}$/.test(customUpiPin)) {
      setErrorText('Please enter a 4-digit numeric UPI PIN (e.g. 1988).');
      return;
    }

    setLoading(true);

    try {
      // 1. Create Auth Account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Send Real Email Verification
      await sendEmailVerification(user);

      // Default simulated linked banks with correct formats (AMIT PAYMENTS BANK as sole provider)
      const defaultBanks = [
        {
          id: 'amit-bank',
          bankName: 'AMIT PAYMENTS BANK',
          accountNumber: '•••• 1988',
          ifsc: 'AMIT0001988',
          balance: 50.00, // Starts with exactly 50 Rupees
          upiPin: customUpiPin, // Since PIN is user-defined now!
          bankType: 'SAVINGS' as const,
          logoColor: '#002E6E',
        }
      ];

      // 3. Write User Document into Firestore with starting balance of exactly 50!
      // This is a direct mandate: starts with ₹50.
      const path = `users/${user.uid}`;
      try {
        await setDoc(doc(db, 'users', user.uid), {
          name: name.trim(),
          phone: phone.trim(),
          upiId: upiId.trim(),
          email: email.trim(),
          balance: 50.00, // Starts with ₹50!
          activeBankId: defaultBanks[0].id,
          bankAccounts: defaultBanks,
          avatarUrl: avatarUrl || null,
          appPin: customUpiPin, // Keep locked screen and balance check PIN matched!
          createdAt: new Date().toISOString()
        });
      } catch (fbErr) {
        handleFirestoreError(fbErr, OperationType.WRITE, path);
      }

      onUserAuthenticated(user);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Login Flow
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Reload auth instance
      await user.reload();

      // Proceed successfully
      onUserAuthenticated(user);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Authentication failed. Please verify your credentials.');
      setLoading(false);
    }
  };

  // Poll/Check Verification Status
  const checkEmailVerificationStatus = async () => {
    if (!pendingVerificationUser) return;
    setErrorText('');
    setLoading(true);

    try {
      await pendingVerificationUser.reload();
      const currentUser = auth.currentUser;

      if (currentUser && currentUser.emailVerified) {
        setSuccessText('Email verified successfully! Welcome to AMITCASH UPI gateway.');
        setTimeout(() => {
          onUserAuthenticated(currentUser);
        }, 1500);
      } else {
        setErrorText('Verification not detected yet. Please make sure to click the email activation link first.');
      }
    } catch (err: any) {
      setErrorText(err.message || 'Error reloading user status.');
    } finally {
      setLoading(false);
    }
  };

  // Resend Verification link
  const resendVerificationMail = async () => {
    if (!pendingVerificationUser) return;
    setErrorText('');
    setLoading(true);

    try {
      await sendEmailVerification(pendingVerificationUser);
      setSuccessText('A new verification email has been dispatched. Please check your inbox!');
      setTimeout(() => setSuccessText(''), 5000);
    } catch (err: any) {
      setErrorText(err.message || 'Unable to re-transmit activation email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
      {/* Decorative premium backdrop sparkles */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-slate-950/85 backdrop-blur-xl border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl relative z-10 p-6 sm:p-8"
      >
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            AMITCASH Premium UPI Wallet Client
          </div>
          <h2 className="font-sans font-extrabold text-2xl text-white tracking-tight">
            AMITCASH Secure Gateway
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Experience next-generation HTML5 instant settlements
          </p>
        </div>

        {/* Global Alert Popups */}
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

        {/* Main interactive state switch */}
        {!pendingVerificationUser ? (
          <div>
            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
              
              {isSignUp && (
                <div className="space-y-4">
                  {/* Name Input */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Full Identity Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Amit Das"
                        className="w-full text-xs bg-slate-900 border border-slate-800 text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>
                  </div>

                  {/* Phone Input */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Mobile Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 94747 88124"
                        className="w-full text-xs bg-slate-900 border border-slate-800 text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:border-indigo-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Live UPI Address preview */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Custom Digital UPI ID (Auto Generated)</label>
                    <input
                      type="text"
                      readOnly
                      value={upiId}
                      className="w-full text-xs font-mono bg-indigo-950/20 border border-indigo-500/20 text-indigo-400 rounded-xl py-3 px-4 outline-none cursor-not-allowed"
                    />
                  </div>

                  {/* Cloudinary custom avatar upload */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Upload Profile Avatar (Cloudinary Preset)</label>
                    <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-850 border border-slate-700 flex items-center justify-center text-slate-400 overflow-hidden relative shrink-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Cloudinary Avatar" className="w-full h-full object-cover" />
                        ) : uploadingAvatar ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          id="avatar-upload"
                          className="hidden"
                          onChange={handleAvatarFile}
                        />
                        <label 
                          htmlFor="avatar-upload"
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors block text-center"
                        >
                          {uploadingAvatar ? 'Uploading...' : 'Choose Picture'}
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Select custom UPI PIN */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Set 4-Digit UPI PIN</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        pattern="[0-9]{4}"
                        maxLength={4}
                        required
                        value={customUpiPin}
                        onChange={(e) => setCustomUpiPin(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. 1988"
                        className="w-full text-xs bg-slate-900 border border-slate-800 text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:border-indigo-500 transition-all font-mono"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">This PIN will be used to show your balance and authorize transactions.</p>
                  </div>

                  {/* Starting reward notice */}
                  <div className="p-3 bg-indigo-950/40 border border-indigo-500/15 rounded-xl flex items-start gap-2">
                    <ShieldCheck className="w-4.5 h-4.5 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[11px] text-white">₹50 Welcoming Balance Reward</p>
                      <p className="text-[10px] text-indigo-300 mt-0.5">As specified, your secure digital peer account starts pre-credited with ₹50 balance.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full text-xs bg-slate-900 border border-slate-800 text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:border-indigo-500 transition-all font-sans"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Secret PIN Keys/Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters password"
                    className="w-full text-xs bg-slate-900 border border-slate-800 text-white rounded-xl py-3 pl-10 pr-4 outline-none focus:border-indigo-500 transition-all font-sans"
                  />
                </div>
              </div>

              {/* Primary action trigger button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-bold text-xs py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    {isSignUp ? 'Request Profile Activation' : 'Authenticate & Sign In'}
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center mt-6 pt-4 border-t border-slate-800">
              <button
                onClick={() => {
                  setErrorText('');
                  setSuccessText('');
                  setIsSignUp(!isSignUp);
                }}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                {isSignUp 
                  ? 'Already have an activated account? Sign In.' 
                  : "New user? Create account & claim initial ₹50."}
              </button>
            </div>
          </div>
        ) : (
          /* Verification Lock pending view */
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto animate-pulse">
              <Mail className="w-7 h-7" />
            </div>

            <div>
              <h3 className="font-sans font-bold text-white text-base">Check Your Email Inbox</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                We have dispatched a verification link to <span className="text-indigo-300 font-semibold">{pendingVerificationUser.email}</span>. Click it to unlock your starting ₹50 wallet and dashboard features!
              </p>
            </div>

            <div className="pt-2 space-y-2.5">
              <button
                onClick={checkEmailVerificationStatus}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-bold text-xs py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-sky-300" />
                    I Have Verified My Email
                  </>
                )}
              </button>

              <button
                onClick={resendVerificationMail}
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 font-sans font-semibold text-xs py-2.5 px-4 rounded-xl transition-colors"
              >
                Resend Verification Link
              </button>

              <button
                onClick={() => {
                  signOut(auth);
                  setPendingVerificationUser(null);
                  setErrorText('');
                }}
                className="text-slate-500 hover:text-slate-400 text-xs font-semibold block mx-auto pt-2"
              >
                Return to Login Page
              </button>
            </div>

            {/* Note instruction to enable email auth provider */}
            <div className="text-[10px] text-slate-500 leading-normal text-left bg-slate-900 border border-slate-800 p-3 rounded-xl mt-4">
              <AlertCircle className="w-3.5 h-3.5 text-indigo-400 float-left mr-1.5 mt-0.5" />
              <span>
                <strong>Note to Developer:</strong> Please ensure Email/Password Sign-In method is enabled under the Firebase Console Authentication settings tab.
              </span>
            </div>
          </motion.div>
        )}

      </motion.div>
    </div>
  );
}
